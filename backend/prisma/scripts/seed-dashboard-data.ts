// Seeds completed historical bookings so the vendor dashboard has real
// numbers to render — KPIs, daily revenue chart, service breakdown.
//
// Usage:
//   npx tsx prisma/scripts/seed-dashboard-data.ts             # all vendors, 60 days
//   npx tsx prisma/scripts/seed-dashboard-data.ts polaris     # only the brand whose name contains "polaris"
//   npx tsx prisma/scripts/seed-dashboard-data.ts polaris 90  # 90-day window
//
// Idempotent enough: if you re-run, you'll just get more historical bookings
// (the script doesn't dedupe — every run adds rows).

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient, type Vendor, type Service, type Bay, type User } from '@prisma/client';

const DEFAULT_DAYS = 60;
// Daily volume bracket — the script picks a random count in this range
// for each day, so the chart has natural variance.
const PER_DAY_MIN = 2;
const PER_DAY_MAX = 8;

const prisma = new PrismaClient();

async function main() {
  const brandFilter = process.argv[2]?.toLowerCase();
  const days = process.argv[3] ? parseInt(process.argv[3], 10) : DEFAULT_DAYS;

  const vendors = await prisma.vendor.findMany({
    where: brandFilter ? { brandName: { contains: brandFilter, mode: 'insensitive' } } : {},
  });
  if (vendors.length === 0) {
    console.error('❌ No vendors matched. Run `npm run db:seed` first.');
    process.exit(1);
  }

  // Need a customer to attribute the bookings to. Re-use any existing customer
  // user, or create a synthetic one called demo-customer@findmybay.ae.
  const customer = await ensureDemoCustomer();

  let totalCreated = 0;
  for (const vendor of vendors) {
    const created = await seedVendorHistory(vendor, customer, days);
    console.log(`  ✓ ${vendor.brandName} — ${created} completed bookings over ${days} days`);
    totalCreated += created;
  }

  console.log('');
  console.log(`✅ Seeded ${totalCreated} historical bookings across ${vendors.length} vendors.`);
  console.log('   Sign in to the vendor admin → Dashboard to see them.');
}

async function ensureDemoCustomer(): Promise<User> {
  const email = 'demo-customer@findmybay.ae';
  // Always upsert the car profile too so the QR / check-in screens have a
  // plate to display in the seeded bookings, even on a fresh DB.
  const profile = {
    phone: '+971501234999',
    fullName: 'Demo Customer',
    role: 'customer' as const,
    carMake: 'Toyota',
    carType: 'suv' as const,
    carColor: 'Black',
    carPlate: 'DUBAI A 12345',
  };
  return prisma.user.upsert({
    where: { email },
    update: profile,
    create: {
      email,
      passwordHash: await bcrypt.hash('demo-customer-2026', 10),
      ...profile,
    },
  });
}

async function seedVendorHistory(vendor: Vendor, customer: User, days: number): Promise<number> {
  // Need services + bays for this vendor. If either is empty, skip the vendor.
  const services = await prisma.service.findMany({
    where: { vendorId: vendor.id, deletedAt: null },
  });
  const bays = await prisma.bay.findMany({
    where: { vendorId: vendor.id, deletedAt: null },
  });
  if (services.length === 0 || bays.length === 0) {
    console.warn(`  ⚠ ${vendor.brandName} — skipping (no services or bays seeded)`);
    return 0;
  }

  // Walk back day-by-day and emit several bookings per day, distributed
  // across the operating window 8am–8pm.
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const dayDate = new Date();
    dayDate.setUTCHours(0, 0, 0, 0);
    dayDate.setUTCDate(dayDate.getUTCDate() - d);

    const todaysCount = randInt(PER_DAY_MIN, PER_DAY_MAX);
    for (let i = 0; i < todaysCount; i++) {
      const service = pick(services);
      const bay = pick(bays);
      const hour = randInt(8, 19); // 8am–7pm slot start
      const minute = pick([0, 15, 30, 45]);
      const slotStart = new Date(dayDate);
      slotStart.setUTCHours(hour, minute, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + service.durationMin * 60_000);

      await prisma.booking.create({
        data: {
          customerId: customer.id,
          vendorId: vendor.id,
          serviceId: service.id,
          bayId: bay.id,
          slotStart,
          slotEnd,
          totalAed: service.priceAed,
          status: 'completed',
        },
      }).catch(() => {
        // Ignore conflicts (same bay+slotStart already booked from a previous
        // run) — the next iteration will pick a different bay/time and
        // succeed.
      });
      count++;
    }
  }

  return count;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
