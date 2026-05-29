// Promotion evaluator + redeemer.
//
// All discount math lives here so the customer-side apply path and the
// vendor admin "live preview" stay perfectly in sync. The pricing
// pipeline at booking-create time is:
//
//   priceLineFromService -> { totalAed, vatAed }
//     ↓ (if a promo code was supplied)
//   evaluatePromo -> { ok | reason, discountAed }
//     ↓
//   final totalAed = base totalAed - discountAed
//
// Currently supports `percent` and `fixed` promo types. `bundle` is
// reserved in the schema but evaluator returns 0 for it until we
// design the "free add-on" bundle math.

import type { Prisma } from '@prisma/client';

export type PromoEvalOk = {
  ok: true;
  discountAed: number;
  promotionId: string;
};

export type PromoEvalErr = {
  ok: false;
  /** Machine code the SPA + Android can map to copy. */
  reason:
    | 'not_found'
    | 'inactive'
    | 'not_started'
    | 'expired'
    | 'service_not_eligible'
    | 'car_type_not_eligible'
    | 'min_spend_not_met'
    | 'usage_limit_reached'
    | 'per_customer_limit_reached'
    | 'wrong_vendor';
};

export type PromoEvalResult = PromoEvalOk | PromoEvalErr;

interface PromoInput {
  /** The promo row (loaded by code lookup). */
  promo: {
    id: string;
    vendorId: string | null;
    type: 'percent' | 'fixed' | 'bundle';
    value: number;
    applicableServiceIds: string[];
    applicableCarTypes: Array<'sedan' | 'hatchback' | 'suv' | 'pickup' | 'van' | 'coupe' | 'other'>;
    minSpendAed: number | null;
    startsAt: Date;
    endsAt: Date;
    usageLimit: number;
    perCustomerLimit: number;
    status: 'active' | 'scheduled' | 'paused' | 'expired' | 'archived';
  };
  /** Booking context to validate against. */
  vendorId: string;
  serviceId: string;
  customerCarType: 'sedan' | 'hatchback' | 'suv' | 'pickup' | 'van' | 'coupe' | 'other' | null;
  /** Gross subtotal before discount (priceLineFromService.totalAed). */
  baseTotalAed: number;
  /** Counts from the DB so we can enforce usage caps. */
  redemptionsTotal: number;
  redemptionsByCustomer: number;
}

/**
 * Pure function — no DB access. Caller fetches the promo + counts and
 * passes them in. Returns either a positive discount in AED or a
 * machine-readable reason the SPA can localise.
 */
export function evaluatePromo(input: PromoInput): PromoEvalResult {
  const { promo, vendorId, serviceId, customerCarType, baseTotalAed } = input;
  const now = Date.now();

  if (promo.status !== 'active') return { ok: false, reason: 'inactive' };
  if (promo.startsAt.getTime() > now) return { ok: false, reason: 'not_started' };
  if (promo.endsAt.getTime() < now) return { ok: false, reason: 'expired' };

  // Vendor-scoped promo must match the booking's vendor. Platform-wide
  // promos (vendorId === null) always pass this check.
  if (promo.vendorId !== null && promo.vendorId !== vendorId) {
    return { ok: false, reason: 'wrong_vendor' };
  }

  // Service / car-type restrictions (empty array = no restriction).
  if (
    promo.applicableServiceIds.length > 0 &&
    !promo.applicableServiceIds.includes(serviceId)
  ) {
    return { ok: false, reason: 'service_not_eligible' };
  }
  if (
    promo.applicableCarTypes.length > 0 &&
    (customerCarType === null || !promo.applicableCarTypes.includes(customerCarType))
  ) {
    return { ok: false, reason: 'car_type_not_eligible' };
  }

  if (promo.minSpendAed !== null && baseTotalAed < promo.minSpendAed) {
    return { ok: false, reason: 'min_spend_not_met' };
  }

  // Caps. usageLimit = 0 means unlimited.
  if (promo.usageLimit > 0 && input.redemptionsTotal >= promo.usageLimit) {
    return { ok: false, reason: 'usage_limit_reached' };
  }
  if (
    promo.perCustomerLimit > 0 &&
    input.redemptionsByCustomer >= promo.perCustomerLimit
  ) {
    return { ok: false, reason: 'per_customer_limit_reached' };
  }

  // Discount math. Rounds to whole AED to keep with the rest of the
  // pricing pipeline (no fractional currency on receipts).
  let discountAed = 0;
  if (promo.type === 'percent') {
    discountAed = Math.round((baseTotalAed * promo.value) / 100);
  } else if (promo.type === 'fixed') {
    discountAed = Math.min(promo.value, baseTotalAed);
  }
  // Never overflow the total.
  discountAed = Math.max(0, Math.min(discountAed, baseTotalAed));

  return { ok: true, discountAed, promotionId: promo.id };
}

/**
 * Status auto-progression. Called when we read a promo from the DB so
 * the vendor admin always sees the right tab (active / scheduled /
 * expired) without a background worker. Pure.
 */
export function derivedPromoStatus(promo: {
  status: 'active' | 'scheduled' | 'paused' | 'expired' | 'archived';
  startsAt: Date;
  endsAt: Date;
}): 'active' | 'scheduled' | 'paused' | 'expired' | 'archived' {
  if (promo.status === 'paused' || promo.status === 'archived') return promo.status;
  const now = Date.now();
  if (promo.endsAt.getTime() < now) return 'expired';
  if (promo.startsAt.getTime() > now) return 'scheduled';
  return 'active';
}

/** Build a where-clause for `prisma.promotion.findMany` from a tab name. */
export function promoTabWhere(
  tab: 'active' | 'scheduled' | 'expired',
): Prisma.PromotionWhereInput {
  const now = new Date();
  if (tab === 'active') {
    return {
      status: 'active',
      startsAt: { lte: now },
      endsAt: { gte: now },
    };
  }
  if (tab === 'scheduled') {
    return {
      status: { in: ['active', 'scheduled'] },
      startsAt: { gt: now },
    };
  }
  // expired
  return { OR: [{ status: 'expired' }, { endsAt: { lt: now } }] };
}
