// Vendor admin → Loyalty.
//
// Two read-only endpoints — loyalty is derived from existing booking
// history, so no writes are needed:
//   GET /admin/loyalty/customers       — paginated roster (tier + spend)
//   GET /admin/loyalty/customers/:id   — one customer's detail
//
// Vendor scoping: the roster lists customers who have at least one
// completed booking with this vendor. Lifetime + tier figures are
// platform-wide (a Gold customer doesn't drop back to Bronze just
// because they're new to this shop), but `bookingsAtVendor` and
// `lastBookingAtVendor` give the local context.

import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { asyncHandler, HttpError } from '../lib/error.js';
import { prisma } from '../config/db.js';
import { requireAuth } from '../auth/middleware.js';
import { requireVendor } from './middleware.js';
import { TIERS, computeTier, loadCustomerLoyalty, loadLoyaltyForCustomers } from '../lib/loyalty.js';

export const loyaltyRouter = Router();

// ── Roster ───────────────────────────────────────────────────────────────

const rosterQuery = z.object({
  tier: z.enum(TIERS).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

loyaltyRouter.get(
  '/loyalty/customers',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const q = rosterQuery.parse(req.query);
    const vendorId = req.vendor!.id;

    // Step 1: find all customers who have completed at least one booking
    // with this vendor. We use distinct on customerId to dedupe; the
    // groupBy below could do this in one shot but Prisma's groupBy needs
    // an aggregate and we want pagination on distinct customers.
    const customerIdRows = await prisma.booking.findMany({
      where: { vendorId, status: 'completed', customerId: { not: null } },
      select: { customerId: true },
      distinct: ['customerId'],
    });
    const allCustomerIds = customerIdRows
      .map((r) => r.customerId)
      .filter((id): id is string => id !== null);

    if (allCustomerIds.length === 0) {
      res.json({
        page: 1,
        pageSize: q.pageSize,
        total: 0,
        items: [],
        counts: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
      });
      return;
    }

    // Step 2: fetch the User rows + loyalty stats in parallel.
    const [users, loyaltyById] = await Promise.all([
      prisma.user.findMany({
        where: {
          id: { in: allCustomerIds },
          ...(q.q
            ? {
                OR: [
                  { fullName: { contains: q.q, mode: Prisma.QueryMode.insensitive } },
                  { phone: { contains: q.q } },
                  { email: { contains: q.q, mode: Prisma.QueryMode.insensitive } },
                  { carPlate: { contains: q.q, mode: Prisma.QueryMode.insensitive } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          carMake: true,
          carType: true,
          carColor: true,
          carPlate: true,
        },
      }),
      loadLoyaltyForCustomers(allCustomerIds, vendorId),
    ]);

    // Step 3: assemble rows + counts. Filter by tier here so we don't
    // need a second SQL pass.
    type Row = {
      id: string;
      name: string | null;
      phone: string | null;
      email: string | null;
      car: { make: string | null; type: string | null; color: string | null; plate: string | null };
      tier: string;
      lifetimeBookings: number;
      lifetimeSpendAed: number;
      bookingsAtVendor: number;
      lastBookingAt: string | null;
    };
    const counts = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    const all: Row[] = [];
    for (const u of users) {
      const l = loyaltyById.get(u.id);
      if (!l) continue;
      counts[l.tier]++;
      if (q.tier && l.tier !== q.tier) continue;
      all.push({
        id: u.id,
        name: u.fullName,
        phone: u.phone,
        email: u.email,
        car: {
          make: u.carMake,
          type: u.carType ? String(u.carType) : null,
          color: u.carColor,
          plate: u.carPlate,
        },
        tier: l.tier,
        lifetimeBookings: l.lifetimeBookings,
        lifetimeSpendAed: l.lifetimeSpendAed,
        bookingsAtVendor: l.bookingsAtVendor ?? 0,
        lastBookingAt: l.lastBookingAt,
      });
    }

    // Sort: highest tier first, then most recent visit. Same intuitive
    // ranking the SPA would do client-side, but cheaper to do once on
    // the server so paging stays consistent across pages.
    const tierRank: Record<string, number> = { platinum: 4, gold: 3, silver: 2, bronze: 1 };
    all.sort((a, b) => {
      const t = tierRank[b.tier] - tierRank[a.tier];
      if (t !== 0) return t;
      const ad = a.lastBookingAt ?? '';
      const bd = b.lastBookingAt ?? '';
      return bd.localeCompare(ad);
    });

    const total = all.length;
    const items = all.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
    res.json({ page: q.page, pageSize: q.pageSize, total, items, counts });
  }),
);

// ── Customer detail ──────────────────────────────────────────────────────

loyaltyRouter.get(
  '/loyalty/customers/:id',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const userId = req.params.id;

    // Confirm this customer has actually booked with us — prevents the
    // owner from probing arbitrary user IDs from another vendor's
    // dashboard.
    const seen = await prisma.booking.findFirst({
      where: { vendorId, customerId: userId },
      select: { id: true },
    });
    if (!seen) {
      throw new HttpError(404, 'Customer not found in your bookings', { code: 'not_found' });
    }

    const [user, loyalty, recent] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          createdAt: true,
          carMake: true,
          carType: true,
          carColor: true,
          carPlate: true,
        },
      }),
      loadCustomerLoyalty(userId, vendorId),
      prisma.booking.findMany({
        where: { customerId: userId, vendorId },
        orderBy: { slotStart: 'desc' },
        take: 10,
        include: { service: { select: { name: true } } },
      }),
    ]);
    if (!user) throw new HttpError(404, 'Customer not found', { code: 'not_found' });

    res.json({
      id: user.id,
      name: user.fullName,
      phone: user.phone,
      email: user.email,
      memberSince: user.createdAt.toISOString(),
      car: {
        make: user.carMake,
        type: user.carType ? String(user.carType) : null,
        color: user.carColor,
        plate: user.carPlate,
      },
      loyalty,
      // Show what they'd need to hit the next tier — gives staff a
      // natural conversation opener ("one more wash gets you Gold").
      nextTier: nextTierProgress(loyalty.lifetimeBookings, loyalty.lifetimeSpendAed),
      recentBookings: recent.map((b) => ({
        id: b.id,
        slotStart: b.slotStart.toISOString(),
        status: String(b.status),
        totalAed: b.totalAed,
        invoiceNumber: b.invoiceNumber,
        serviceName: b.service.name,
      })),
    });
  }),
);

// ── Tier progress helper ─────────────────────────────────────────────────

function nextTierProgress(
  lifetimeBookings: number,
  lifetimeSpendAed: number,
): {
  current: string;
  next: string | null;
  bookingsToGo: number | null;
  spendToGoAed: number | null;
} {
  const current = computeTier({ lifetimeBookings, lifetimeSpendAed });
  if (current === 'platinum') {
    return { current, next: null, bookingsToGo: null, spendToGoAed: null };
  }
  const nextThreshold = (() => {
    switch (current) {
      case 'bronze':   return { tier: 'silver',   bookings: 3,  spend: null };
      case 'silver':   return { tier: 'gold',     bookings: 10, spend: 2000 };
      case 'gold':     return { tier: 'platinum', bookings: 25, spend: 5000 };
    }
  })();
  return {
    current,
    next: nextThreshold.tier,
    bookingsToGo: Math.max(nextThreshold.bookings - lifetimeBookings, 0),
    spendToGoAed:
      nextThreshold.spend != null
        ? Math.max(nextThreshold.spend - lifetimeSpendAed, 0)
        : null,
  };
}
