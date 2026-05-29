// Loyalty tier derivation.
//
// V1 keeps loyalty as a *derived* property — no accrual ledger, no
// expiring points. The tier is computed on read from a customer's
// completed-booking history. Two signals decide the tier:
//   - lifetimeBookings: how many completed washes the customer has
//   - lifetimeSpendAed: gross total they've spent (incl VAT)
//
// Tier thresholds are platform-wide (a Platinum customer stays Platinum
// regardless of which vendor they're booking with). Vendors also get a
// per-vendor `bookingsAtVendor` count so they can tell "this is their
// first wash with us" from "this is their 8th".
//
// Why derive, not accrue? A V1 with a worker that decays points is
// strictly more code + more places to drift. We can switch to a
// LoyaltyPoint table later without changing the public tier semantics:
// `computeTier` becomes "look up the cached row" instead of "count
// completed bookings", and the badge UI stays identical.

import { prisma } from '../config/db.js';

export const TIERS = ['bronze', 'silver', 'gold', 'platinum'] as const;
export type LoyaltyTier = (typeof TIERS)[number];

/**
 * Pure tier computation. Exposed separately so tests + dashboards can
 * preview "what would happen if I bumped these thresholds?" without
 * mocking the database.
 *
 * Rules:
 *   Platinum: 25+ bookings OR 5000+ AED spend
 *   Gold:     10+ bookings OR 2000+ AED spend
 *   Silver:    3+ bookings
 *   Bronze:   default
 *
 * Spend thresholds let a high-roller jump tiers in fewer visits while
 * keeping the "loyal regular" path intact for cheaper services.
 */
export function computeTier(input: {
  lifetimeBookings: number;
  lifetimeSpendAed: number;
}): LoyaltyTier {
  const { lifetimeBookings, lifetimeSpendAed } = input;
  if (lifetimeBookings >= 25 || lifetimeSpendAed >= 5000) return 'platinum';
  if (lifetimeBookings >= 10 || lifetimeSpendAed >= 2000) return 'gold';
  if (lifetimeBookings >= 3) return 'silver';
  return 'bronze';
}

export interface CustomerLoyalty {
  tier: LoyaltyTier;
  lifetimeBookings: number;
  lifetimeSpendAed: number;
  // Only set when computed for a specific vendor (i.e. in the vendor-admin
  // path). Tells the vendor "this is their Nth wash with us" so the staff
  // can greet regulars by remembering them.
  bookingsAtVendor?: number;
  // ISO timestamp of the most recent completed booking — drives the
  // "Last visit" column on the loyalty page. Null for brand-new customers.
  lastBookingAt: string | null;
}

/**
 * Compute a single customer's loyalty snapshot. Walk-ins (customerId=null)
 * don't have a loyalty record; the caller passes null and we return the
 * default Bronze tier so the UI can still render a chip.
 */
export async function loadCustomerLoyalty(
  customerId: string | null,
  vendorIdForLocalCount?: string,
): Promise<CustomerLoyalty> {
  if (!customerId) {
    return { tier: 'bronze', lifetimeBookings: 0, lifetimeSpendAed: 0, lastBookingAt: null };
  }

  // Single aggregate covers count + spend; second small query gets the
  // most-recent slot so we can show "Last visit 3 days ago" cheaply.
  const [agg, last, atVendor] = await Promise.all([
    prisma.booking.aggregate({
      where: { customerId, status: 'completed' },
      _count: { _all: true },
      _sum: { totalAed: true },
    }),
    prisma.booking.findFirst({
      where: { customerId, status: 'completed' },
      orderBy: { slotStart: 'desc' },
      select: { slotStart: true },
    }),
    vendorIdForLocalCount
      ? prisma.booking.count({
          where: { customerId, vendorId: vendorIdForLocalCount, status: 'completed' },
        })
      : Promise.resolve(undefined),
  ]);

  const lifetimeBookings = agg._count._all;
  const lifetimeSpendAed = agg._sum.totalAed ?? 0;
  const tier = computeTier({ lifetimeBookings, lifetimeSpendAed });

  return {
    tier,
    lifetimeBookings,
    lifetimeSpendAed,
    bookingsAtVendor: atVendor,
    lastBookingAt: last?.slotStart.toISOString() ?? null,
  };
}

/**
 * Batch variant for the loyalty roster page. Avoids the N+1 you'd get
 * from looping `loadCustomerLoyalty` per customer: one aggregate query
 * across all of the vendor's customers + one per-vendor count query.
 *
 * Returns a map keyed by customerId so the route handler can stitch
 * loyalty data onto a customer list it built separately.
 */
export async function loadLoyaltyForCustomers(
  customerIds: string[],
  vendorId: string,
): Promise<Map<string, CustomerLoyalty>> {
  if (customerIds.length === 0) return new Map();

  const [perCustomer, perCustomerAtVendor, lastVisits] = await Promise.all([
    prisma.booking.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds }, status: 'completed' },
      _count: { _all: true },
      _sum: { totalAed: true },
    }),
    prisma.booking.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: customerIds },
        vendorId,
        status: 'completed',
      },
      _count: { _all: true },
    }),
    // Most recent slot per customer. Postgres-friendly DISTINCT ON via raw.
    prisma.$queryRaw<Array<{ customer_id: string; slot_start: Date }>>`
      SELECT DISTINCT ON ("customer_id") "customer_id", "slot_start"
        FROM "bookings"
       WHERE "customer_id" = ANY(${customerIds})
         AND "status" = 'completed'
       ORDER BY "customer_id", "slot_start" DESC
    `,
  ]);

  const atVendorById = new Map(
    perCustomerAtVendor.map((r) => [r.customerId!, r._count._all] as const),
  );
  const lastById = new Map(lastVisits.map((r) => [r.customer_id, r.slot_start] as const));

  const out = new Map<string, CustomerLoyalty>();
  for (const r of perCustomer) {
    if (!r.customerId) continue;
    const lifetimeBookings = r._count._all;
    const lifetimeSpendAed = r._sum.totalAed ?? 0;
    out.set(r.customerId, {
      tier: computeTier({ lifetimeBookings, lifetimeSpendAed }),
      lifetimeBookings,
      lifetimeSpendAed,
      bookingsAtVendor: atVendorById.get(r.customerId) ?? 0,
      lastBookingAt: lastById.get(r.customerId)?.toISOString() ?? null,
    });
  }

  // Customers with zero completed bookings won't appear in the groupBy —
  // pad them in as Bronze so the caller can render them uniformly.
  for (const id of customerIds) {
    if (!out.has(id)) {
      out.set(id, {
        tier: 'bronze',
        lifetimeBookings: 0,
        lifetimeSpendAed: 0,
        bookingsAtVendor: 0,
        lastBookingAt: null,
      });
    }
  }

  return out;
}
