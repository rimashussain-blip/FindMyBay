// Seed sample UAE car washes so the app shows real data on day one.
//
// Run: npm run db:seed
//
// Coordinates are real UAE locations chosen so they spread across the
// Dubai/Sharjah/Abu Dhabi axis. They're approximate — fine for dev.

import 'dotenv/config'; // tsx doesn't auto-load .env like the prisma CLI does
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'fmb-demo-2026';
const ADMIN_PASSWORD = 'fmb-admin-2026';

interface SeedVendor {
  brandName: string;
  city: string;
  emirate:
    | 'AbuDhabi'
    | 'Dubai'
    | 'Sharjah'
    | 'Ajman'
    | 'UmmAlQuwain'
    | 'RasAlKhaimah'
    | 'Fujairah';
  addressLine: string;
  lat: number;
  lng: number;
  rating: number;
  priceFromAed: number;
  bays: number;
  freeBays: number; // first N bays are free, the rest are busy
  services: { name: string; durationMin: number; priceAed: number }[];
}

const VENDORS: SeedVendor[] = [
  {
    brandName: 'Polaris Auto Spa',
    city: 'Dubai',
    emirate: 'Dubai',
    addressLine: 'Business Bay, Dubai',
    lat: 25.1881,
    lng: 55.2645,
    rating: 4.7,
    priceFromAed: 35,
    bays: 4,
    freeBays: 2,
    services: [
      { name: 'Quick Exterior Wash', durationMin: 20, priceAed: 35 },
      { name: 'Premium Wash & Wax', durationMin: 45, priceAed: 89 },
      { name: 'Interior + Exterior Detail', durationMin: 90, priceAed: 199 },
    ],
  },
  {
    brandName: 'Marina Shine',
    city: 'Dubai',
    emirate: 'Dubai',
    addressLine: 'Dubai Marina, JBR Walk',
    lat: 25.0772,
    lng: 55.1342,
    rating: 4.5,
    priceFromAed: 40,
    bays: 3,
    freeBays: 1,
    services: [
      { name: 'Standard Wash', durationMin: 25, priceAed: 40 },
      { name: 'SUV Premium', durationMin: 50, priceAed: 110 },
    ],
  },
  {
    brandName: 'Al Quoz Detailing',
    city: 'Dubai',
    emirate: 'Dubai',
    addressLine: 'Al Quoz Industrial Area 3',
    lat: 25.1422,
    lng: 55.2378,
    rating: 4.3,
    priceFromAed: 30,
    bays: 6,
    freeBays: 4,
    services: [
      { name: 'Express Wash', durationMin: 15, priceAed: 30 },
      { name: 'Full Detail', durationMin: 120, priceAed: 249 },
      { name: 'Bike Wash', durationMin: 20, priceAed: 25 },
    ],
  },
  {
    brandName: 'Sharjah Auto Care',
    city: 'Sharjah',
    emirate: 'Sharjah',
    addressLine: 'Al Nahda, Sharjah',
    lat: 25.2925,
    lng: 55.3722,
    rating: 4.4,
    priceFromAed: 28,
    bays: 3,
    freeBays: 2,
    services: [
      { name: 'Basic Wash', durationMin: 20, priceAed: 28 },
      { name: 'Wash + Polish', durationMin: 60, priceAed: 95 },
    ],
  },
  {
    brandName: 'Majaz Lagoon Wash',
    city: 'Sharjah',
    emirate: 'Sharjah',
    addressLine: 'Jamal Abdul Nasser St, Al Majaz 2, Sharjah',
    lat: 25.336,
    lng: 55.388,
    rating: 4.6,
    priceFromAed: 32,
    bays: 4,
    freeBays: 3,
    services: [
      { name: 'Quick Exterior', durationMin: 20, priceAed: 32 },
      { name: 'Standard Wash', durationMin: 35, priceAed: 55 },
      { name: 'Premium Shine', durationMin: 60, priceAed: 110 },
    ],
  },
  {
    brandName: 'Yas Premium Wash',
    city: 'Abu Dhabi',
    emirate: 'AbuDhabi',
    addressLine: 'Yas Marina, Abu Dhabi',
    lat: 24.4672,
    lng: 54.6031,
    rating: 4.8,
    priceFromAed: 50,
    bays: 5,
    freeBays: 3,
    services: [
      { name: 'Premium Hand Wash', durationMin: 35, priceAed: 50 },
      { name: 'Ceramic Touch-up', durationMin: 90, priceAed: 299 },
    ],
  },
];

async function main() {
  // Idempotent: wipe and re-seed so this is safe to run repeatedly in dev.
  console.log('🧹 Clearing existing seed data…');
  await prisma.booking.deleteMany();
  await prisma.bay.deleteMany();
  await prisma.service.deleteMany();
  await prisma.vendorMember.deleteMany();
  await prisma.vendor.deleteMany();

  console.log(`🌱 Seeding ${VENDORS.length} vendors…`);
  for (const v of VENDORS) {
    const vendor = await prisma.vendor.create({
      data: {
        brandName: v.brandName,
        city: v.city,
        emirate: v.emirate,
        addressLine: v.addressLine,
        lat: v.lat,
        lng: v.lng,
        ratingAvg: v.rating,
        priceFromAed: v.priceFromAed,
        status: 'active',
      },
    });

    // Bays: first N are free, the rest are busy.
    for (let i = 0; i < v.bays; i++) {
      await prisma.bay.create({
        data: {
          vendorId: vendor.id,
          name: `Bay ${i + 1}`,
          bayType: 'sedan',
          status: i < v.freeBays ? 'free' : 'busy',
        },
      });
    }

    for (const s of v.services) {
      await prisma.service.create({
        data: {
          vendorId: vendor.id,
          name: s.name,
          durationMin: s.durationMin,
          priceAed: s.priceAed,
          vatInclusive: true,
        },
      });
    }

    console.log(`  ✓ ${v.brandName} (${v.city}) — ${v.bays} bays, ${v.freeBays} free`);
  }

  // ── Vendor staff for the admin SPA demo ─────────────────────────────────
  console.log('👤 Seeding vendor owner accounts…');
  const polaris = await prisma.vendor.findFirst({ where: { brandName: 'Polaris Auto Spa' } });
  const marina = await prisma.vendor.findFirst({ where: { brandName: 'Marina Shine' } });

  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  if (polaris) {
    const owner = await prisma.user.upsert({
      where: { email: 'polaris@findmybay.ae' },
      update: {
        fullName: 'Polaris Owner',
        role: 'vendor_owner',
        passwordHash: demoHash,
        phone: '+971500000001',
      },
      create: {
        email: 'polaris@findmybay.ae',
        passwordHash: demoHash,
        phone: '+971500000001',
        fullName: 'Polaris Owner',
        role: 'vendor_owner',
      },
    });
    await prisma.vendorMember.upsert({
      where: { userId_vendorId: { userId: owner.id, vendorId: polaris.id } },
      update: { role: 'owner' },
      create: { userId: owner.id, vendorId: polaris.id, role: 'owner' },
    });
    console.log(`  ✓ polaris@findmybay.ae / ${DEMO_PASSWORD} → owner of ${polaris.brandName}`);
  }
  if (marina) {
    const owner = await prisma.user.upsert({
      where: { email: 'marina@findmybay.ae' },
      update: {
        fullName: 'Marina Owner',
        role: 'vendor_owner',
        passwordHash: demoHash,
        phone: '+971500000002',
      },
      create: {
        email: 'marina@findmybay.ae',
        passwordHash: demoHash,
        phone: '+971500000002',
        fullName: 'Marina Owner',
        role: 'vendor_owner',
      },
    });
    await prisma.vendorMember.upsert({
      where: { userId_vendorId: { userId: owner.id, vendorId: marina.id } },
      update: { role: 'owner' },
      create: { userId: owner.id, vendorId: marina.id, role: 'owner' },
    });
    console.log(`  ✓ marina@findmybay.ae / ${DEMO_PASSWORD} → owner of ${marina.brandName}`);
  }

  // ── Platform super admin ──────────────────────────────────────────────
  console.log('👑 Seeding platform super-admin…');
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: 'admin@findmybay.ae' },
    update: {
      fullName: 'Platform Admin',
      role: 'admin',
      passwordHash: adminHash,
    },
    create: {
      email: 'admin@findmybay.ae',
      fullName: 'Platform Admin',
      role: 'admin',
      passwordHash: adminHash,
    },
  });
  console.log(`  ✓ admin@findmybay.ae / ${ADMIN_PASSWORD} → platform super-admin`);

  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
