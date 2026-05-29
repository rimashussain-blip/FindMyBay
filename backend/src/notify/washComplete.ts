// Sends the "Your car is fresh & ready" push when a booking transitions to
// completed. Resolves the customer's device tokens and pulls the wash details
// (vendor, service, bay) into a friendly notification body.

import { prisma } from '../config/db.js';
import { getPushClient } from '../lib/push.js';
import { logger } from '../lib/logger.js';

export async function sendWashCompletePush(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: { select: { id: true, fullName: true } },
      vendor: { select: { brandName: true } },
      service: { select: { name: true, durationMin: true } },
      bay: { select: { name: true } },
    },
  });
  if (!booking) {
    logger.warn({ bookingId }, 'wash-complete push: booking not found');
    return;
  }

  // Walk-in bookings have no registered customer, so there are no device
  // tokens to push to. Quietly skip — vendor staff is the only audience and
  // they already know the wash is done because they triggered the status
  // change themselves.
  if (!booking.customerId) {
    logger.info({ bookingId }, 'wash-complete push: walk-in booking, skipping');
    return;
  }

  const tokens = await prisma.deviceToken.findMany({
    where: { userId: booking.customerId },
    select: { fcmToken: true },
  });
  if (tokens.length === 0) {
    logger.info({ bookingId }, 'wash-complete push: no device tokens');
  }

  const vendorName = booking.vendor.brandName;
  const serviceName = booking.service.name;
  const bayName = booking.bay?.name ?? 'your bay';

  const push = getPushClient();
  await push.send(
    tokens.map((t) => t.fcmToken),
    {
      title: '✨ Your car is fresh & ready',
      body: `${vendorName} just finished your ${serviceName} in ${bayName}. Pick up whenever you're ready — no rush.`,
      data: {
        kind: 'wash_complete',
        bookingId: booking.id,
        vendorName,
        serviceName,
        bayName,
        durationMin: String(booking.service.durationMin),
        totalAed: String(booking.totalAed),
      },
    },
  );
}
