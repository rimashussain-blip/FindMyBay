// Booking creation + listing.

import { prisma } from '../config/db.js';
import { HttpError } from '../lib/error.js';
import { logger } from '../lib/logger.js';
import { priceLineFromService } from '../lib/vat.js';
import { evaluatePromo } from '../lib/promo.js';

export interface CreateBookingInput {
  customerId: string;
  vendorId: string;
  serviceId: string;
  slotStartIso: string; // ISO8601 with timezone
  /** Optional promo code customer entered at checkout. Uppercased before lookup. */
  promoCode?: string;
}

export interface BookingDto {
  id: string;
  status: string;
  vendor: {
    id: string;
    brandName: string;
    city: string;
    emirate: string;
    logoUrl: string | null;
  };
  service: { id: string; name: string; durationMin: number; priceAed: number };
  bay: { id: string; name: string };
  slotStart: string;
  slotEnd: string;
  /** Net total after promo discount + VAT-inclusive math. */
  totalAed: number;
  vatAed: number;
  /** AED knocked off via a promo code at create time. 0 if none applied. */
  discountAed: number;
  /** Code of the promo that was applied (so the receipt can show it). */
  promoCode: string | null;
  /** FTA-compliant invoice number, assigned once the booking is billable. */
  invoiceNumber: string | null;
  createdAt: string;
}

// Bookings created in pending_payment that are older than this are treated as
// abandoned: their slot is releasable, and a fresh booking can take their bay.
const PENDING_PAYMENT_HOLD_MS = 15 * 60 * 1000;

/**
 * Create a booking in `pending_payment`. The customer must POST /bookings/:id/pay
 * to drive it through the configured processor; the smart-alert is scheduled
 * only after payment succeeds.
 *
 * Slot conflicts include any active booking AND any pending_payment booking
 * created in the last 15 minutes — to avoid two customers each starting a
 * payment for the same bay at the same time.
 */
export async function createBooking(input: CreateBookingInput): Promise<BookingDto> {
  const { customerId, vendorId, serviceId, slotStartIso } = input;

  const slotStart = new Date(slotStartIso);
  if (isNaN(slotStart.getTime()))
    throw new HttpError(400, 'Invalid slotStart timestamp', { code: 'invalid_slot' });
  if (slotStart.getTime() < Date.now() - 60_000)
    throw new HttpError(400, 'Slot is in the past', { code: 'slot_in_past' });

  const holdCutoff = new Date(Date.now() - PENDING_PAYMENT_HOLD_MS);

  // Step 1: create the booking inside a transaction so bay-selection +
  // overlap check + insert is atomic.
  const booking = await prisma.$transaction(async (tx) => {
    const service = await tx.service.findFirst({
      where: { id: serviceId, vendorId, deletedAt: null },
    });
    if (!service)
      throw new HttpError(404, 'Service not found for this vendor', { code: 'service_not_found' });

    const slotEnd = new Date(slotStart.getTime() + service.durationMin * 60_000);

    const bays = await tx.bay.findMany({
      where: { vendorId, deletedAt: null, status: { not: 'closed' } },
      orderBy: { name: 'asc' },
    });
    if (bays.length === 0)
      throw new HttpError(409, 'No bays available at this vendor', { code: 'no_bays' });

    const conflicts = await tx.booking.findMany({
      where: {
        vendorId,
        bayId: { in: bays.map((b) => b.id) },
        slotStart: { lt: slotEnd },
        slotEnd: { gt: slotStart },
        OR: [
          { status: { in: ['confirmed', 'alert_scheduled', 'alerted', 'in_progress'] } },
          // Hold the bay for an in-flight payment, but only briefly.
          { status: 'pending_payment', createdAt: { gt: holdCutoff } },
        ],
      },
      select: { bayId: true },
    });
    const busyBayIds = new Set(conflicts.map((c) => c.bayId));
    const bay = bays.find((b) => !busyBayIds.has(b.id));
    if (!bay)
      throw new HttpError(409, 'All bays are booked for this slot', { code: 'no_slot_available' });

    const { totalAed: grossTotal, vatAed } = priceLineFromService(
      service.priceAed,
      service.vatInclusive,
    );

    // ── Promo evaluation (optional) ─────────────────────────────────────
    // If the customer typed a code, validate it server-side and apply
    // the discount before we write the booking. Per-customer + global
    // usage caps are evaluated against the current redemption counts
    // INSIDE the transaction so two concurrent applies can't double-
    // spend the last available slot of a capped promo.
    let promotionId: string | null = null;
    let discountAed = 0;
    if (input.promoCode) {
      const promo = await tx.promotion.findFirst({
        where: { code: input.promoCode.toUpperCase(), OR: [{ vendorId }, { vendorId: null }] },
      });
      if (!promo) {
        throw new HttpError(404, 'Promo code not recognised', { code: 'promo_not_found' });
      }
      // Customer's car type — used by promos restricted to a specific body.
      const customer = await tx.user.findUnique({
        where: { id: customerId },
        select: { carType: true },
      });
      const [redemptionsTotal, redemptionsByCustomer] = await Promise.all([
        tx.promotionRedemption.count({ where: { promotionId: promo.id } }),
        tx.promotionRedemption.count({
          where: { promotionId: promo.id, customerId },
        }),
      ]);
      const ev = evaluatePromo({
        promo: {
          id: promo.id,
          vendorId: promo.vendorId,
          type: promo.type as 'percent' | 'fixed' | 'bundle',
          value: promo.value,
          applicableServiceIds: promo.applicableServiceIds,
          applicableCarTypes: promo.applicableCarTypes as ('sedan' | 'hatchback' | 'suv' | 'pickup' | 'van' | 'coupe' | 'other')[],
          minSpendAed: promo.minSpendAed,
          startsAt: promo.startsAt,
          endsAt: promo.endsAt,
          usageLimit: promo.usageLimit,
          perCustomerLimit: promo.perCustomerLimit,
          status: promo.status as 'active' | 'scheduled' | 'paused' | 'expired' | 'archived',
        },
        vendorId,
        serviceId: service.id,
        customerCarType: (customer?.carType as 'sedan' | 'hatchback' | 'suv' | 'pickup' | 'van' | 'coupe' | 'other' | null) ?? null,
        baseTotalAed: grossTotal,
        redemptionsTotal,
        redemptionsByCustomer,
      });
      if (!ev.ok) {
        throw new HttpError(409, `Promo can't be applied: ${ev.reason.replace(/_/g, ' ')}`, {
          code: `promo_${ev.reason}`,
        });
      }
      promotionId = ev.promotionId;
      discountAed = ev.discountAed;
    }

    const finalTotal = grossTotal - discountAed;
    const booking = await tx.booking.create({
      data: {
        customerId,
        vendorId,
        bayId: bay.id,
        serviceId: service.id,
        slotStart,
        slotEnd,
        totalAed: finalTotal,
        vatAed,
        promotionId,
        discountAed,
        status: 'pending_payment',
      },
      include: {
        vendor: { select: { id: true, brandName: true, city: true, emirate: true, logoUrl: true } },
        service: { select: { id: true, name: true, durationMin: true, priceAed: true } },
        bay: { select: { id: true, name: true } },
        promotion: { select: { code: true } },
      },
    });
    // Record the redemption now — the per-customer + global counts above
    // already locked the right number under the transaction, so this is
    // safe to insert here.
    if (promotionId && discountAed > 0) {
      await tx.promotionRedemption.create({
        data: {
          promotionId,
          bookingId: booking.id,
          customerId,
          amountOffAed: discountAed,
        },
      });
    }
    return booking;
  });

  logger.info(
    { bookingId: booking.id, vendorId, bayId: booking.bayId, slotStart },
    'booking created (pending_payment)',
  );

  return toDto(booking);
}

export async function listMyBookings(customerId: string): Promise<BookingDto[]> {
  const rows = await prisma.booking.findMany({
    where: { customerId },
    orderBy: { slotStart: 'desc' },
    take: 50,
    include: {
      vendor: { select: { id: true, brandName: true, city: true, emirate: true, logoUrl: true } },
      service: { select: { id: true, name: true, durationMin: true, priceAed: true } },
      bay: { select: { id: true, name: true } },
      promotion: { select: { code: true } },
    },
  });
  return rows.map(toDto);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDto(b: any): BookingDto {
  return {
    id: b.id,
    status: String(b.status),
    vendor: {
      id: b.vendor.id,
      brandName: b.vendor.brandName,
      city: b.vendor.city,
      emirate: String(b.vendor.emirate),
      logoUrl: b.vendor.logoUrl ?? null,
    },
    service: {
      id: b.service.id,
      name: b.service.name,
      durationMin: b.service.durationMin,
      priceAed: b.service.priceAed,
    },
    bay: { id: b.bay.id, name: b.bay.name },
    slotStart: b.slotStart.toISOString(),
    slotEnd: b.slotEnd.toISOString(),
    totalAed: b.totalAed,
    vatAed: b.vatAed,
    discountAed: b.discountAed ?? 0,
    promoCode: b.promotion?.code ?? null,
    invoiceNumber: b.invoiceNumber,
    createdAt: b.createdAt.toISOString(),
  };
}
