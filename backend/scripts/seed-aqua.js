// One-shot seed: Aqua Car Wash + owner + services + bays + products +
// recipes + supplier + promo + sample bookings.
//
// The owner password is read from the SEED_OWNER_PASSWORD env var so
// it's never committed to source. If it's missing the script aborts.
//
// Run locally against prod:
//   DATABASE_URL=... SEED_OWNER_PASSWORD=... node backend/scripts/seed-aqua.js
//
// Or inside the container:
//   az containerapp exec --name fmb-backend --resource-group fmb-prod-rg \
//     --command "sh -c 'export SEED_OWNER_PASSWORD=...; node /tmp/seed-aqua.js'"
//
// Idempotent — safe to re-run. Uses known IDs so updates land on the
// same rows. The PostGIS geom column is set via raw SQL after the
// upsert (Prisma can't write Unsupported types).

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const VENDOR_ID = 'seed-aqua-car-wash';
const OWNER_EMAIL = 'owner@aquacarwash.ae';
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD;
if (!OWNER_PASSWORD || OWNER_PASSWORD.length < 10) {
  console.error(
    'SEED_OWNER_PASSWORD env var is required (10+ chars). Set it before running.',
  );
  process.exit(1);
}

// Stable IDs so re-running the seed updates existing rows.
const S = {
  quickWash: 'seed-aqua-svc-quick',
  fullWash: 'seed-aqua-svc-full',
  deepClean: 'seed-aqua-svc-deep',
  premiumDetail: 'seed-aqua-svc-premium',
};
const B = {
  bay1: 'seed-aqua-bay-1',
  bay2: 'seed-aqua-bay-2',
  bay3: 'seed-aqua-bay-3',
};
const P = {
  microfiber: 'seed-aqua-prd-microfiber',
  foamSoap: 'seed-aqua-prd-foam',
  wax: 'seed-aqua-prd-wax',
  tireShine: 'seed-aqua-prd-tire',
  windowCleaner: 'seed-aqua-prd-window',
};
const SUP_ID = 'seed-aqua-supplier-1';
const PROMO_ID = 'seed-aqua-promo-aqua10';

const prisma = new PrismaClient();

async function main() {
  console.log('==> Aqua Car Wash seed starting');

  // ── 1. Owner user ───────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 10);
  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: {
      passwordHash,
      fullName: 'Ahmed Al Mansoori',
      role: 'vendor_owner',
      emailVerifiedAt: new Date(),
    },
    create: {
      email: OWNER_EMAIL,
      passwordHash,
      fullName: 'Ahmed Al Mansoori',
      role: 'vendor_owner',
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`   user ${owner.id} (${OWNER_EMAIL})`);

  // ── 2. Vendor ───────────────────────────────────────────────────
  const vendor = await prisma.vendor.upsert({
    where: { id: VENDOR_ID },
    update: {
      brandName: 'Aqua Car Wash',
      tradeLicenseNo: 'DED-AQ-2026-998877',
      trnNumber: '100123456789003',
      city: 'Dubai',
      emirate: 'Dubai',
      addressLine: 'Warehouse 12, Industrial Area 4, Al Quoz',
      lat: 25.1325,
      lng: 55.2294,
      status: 'active',
      ratingAvg: 4.7,
      priceFromAed: 50,
      hours: {
        mon: { open: '08:00', close: '22:00' },
        tue: { open: '08:00', close: '22:00' },
        wed: { open: '08:00', close: '22:00' },
        thu: { open: '08:00', close: '22:00' },
        fri: { open: '08:00', close: '23:00' },
        sat: { open: '08:00', close: '23:00' },
        sun: { open: '09:00', close: '21:00' },
      },
    },
    create: {
      id: VENDOR_ID,
      brandName: 'Aqua Car Wash',
      tradeLicenseNo: 'DED-AQ-2026-998877',
      trnNumber: '100123456789003',
      city: 'Dubai',
      emirate: 'Dubai',
      addressLine: 'Warehouse 12, Industrial Area 4, Al Quoz',
      lat: 25.1325,
      lng: 55.2294,
      status: 'active',
      ratingAvg: 4.7,
      priceFromAed: 50,
      hours: {
        mon: { open: '08:00', close: '22:00' },
        tue: { open: '08:00', close: '22:00' },
        wed: { open: '08:00', close: '22:00' },
        thu: { open: '08:00', close: '22:00' },
        fri: { open: '08:00', close: '23:00' },
        sat: { open: '08:00', close: '23:00' },
        sun: { open: '09:00', close: '21:00' },
      },
    },
  });
  // PostGIS geom column — set via raw SQL since Prisma's Unsupported type
  // doesn't expose a write path. Triggers the spatial index update.
  await prisma.$executeRaw`
    UPDATE vendors
       SET geom = ST_SetSRID(ST_MakePoint(${vendor.lng}, ${vendor.lat}), 4326)
     WHERE id = ${vendor.id}
  `;
  console.log(`   vendor ${vendor.id} (${vendor.brandName})`);

  // ── 3. Owner ↔ vendor link ─────────────────────────────────────
  await prisma.vendorMember.upsert({
    where: { userId_vendorId: { userId: owner.id, vendorId: vendor.id } },
    update: { role: 'owner', status: 'active' },
    create: {
      userId: owner.id,
      vendorId: vendor.id,
      role: 'owner',
      status: 'active',
    },
  });
  console.log('   vendor_member owner link ok');

  // ── 4. Services ────────────────────────────────────────────────
  const services = [
    {
      id: S.quickWash,
      name: 'Quick Wash',
      durationMin: 20,
      priceAed: 50,
      vatInclusive: true,
      carTypes: ['sedan', 'hatchback', 'coupe'],
    },
    {
      id: S.fullWash,
      name: 'Full Wash',
      durationMin: 45,
      priceAed: 100,
      vatInclusive: true,
      carTypes: [],
    },
    {
      id: S.deepClean,
      name: 'Deep Clean',
      durationMin: 90,
      priceAed: 200,
      vatInclusive: true,
      carTypes: [],
    },
    {
      id: S.premiumDetail,
      name: 'Premium Detail',
      durationMin: 180,
      priceAed: 450,
      vatInclusive: true,
      carTypes: ['suv', 'pickup', 'van'],
    },
  ];
  for (const s of services) {
    await prisma.service.upsert({
      where: { id: s.id },
      update: {
        name: s.name,
        durationMin: s.durationMin,
        priceAed: s.priceAed,
        vatInclusive: s.vatInclusive,
        carTypes: s.carTypes,
        deletedAt: null,
      },
      create: { ...s, vendorId: vendor.id },
    });
  }
  console.log(`   services ${services.length}`);

  // ── 5. Bays ────────────────────────────────────────────────────
  const bays = [
    { id: B.bay1, name: 'Bay 1', bayType: 'sedan' },
    { id: B.bay2, name: 'Bay 2', bayType: 'sedan' },
    { id: B.bay3, name: 'Bay 3', bayType: 'suv' },
  ];
  for (const b of bays) {
    await prisma.bay.upsert({
      where: { id: b.id },
      update: { name: b.name, bayType: b.bayType, status: 'free', deletedAt: null },
      create: { ...b, vendorId: vendor.id, status: 'free' },
    });
  }
  console.log(`   bays ${bays.length}`);

  // ── 6. Products (inventory) ────────────────────────────────────
  const products = [
    {
      id: P.microfiber,
      name: 'Microfiber Towel (large)',
      category: 'towel',
      unit: 'pcs',
      costAed: 12,
      stockQty: 80,
      lowStockThreshold: 20,
      location: 'Storeroom shelf 1',
    },
    {
      id: P.foamSoap,
      name: 'Foam Shampoo (3.7L)',
      category: 'soap',
      unit: 'bottle',
      costAed: 95,
      stockQty: 14,
      lowStockThreshold: 5,
      location: 'Storeroom shelf 2',
    },
    {
      id: P.wax,
      name: 'Carnauba Wax Spray (500ml)',
      category: 'wax',
      unit: 'bottle',
      costAed: 60,
      stockQty: 9,
      lowStockThreshold: 4,
      location: 'Bay 1 cabinet',
    },
    {
      id: P.tireShine,
      name: 'Tire Shine (1L)',
      category: 'consumable',
      unit: 'bottle',
      costAed: 35,
      stockQty: 6,
      lowStockThreshold: 3,
      location: 'Bay 3 cabinet',
    },
    {
      id: P.windowCleaner,
      name: 'Glass Cleaner (1L)',
      category: 'consumable',
      unit: 'bottle',
      costAed: 28,
      stockQty: 3, // intentionally low to demo the banner
      lowStockThreshold: 5,
      location: 'Storeroom shelf 2',
    },
  ];
  for (const pr of products) {
    await prisma.product.upsert({
      where: { id: pr.id },
      update: { ...pr, deletedAt: null },
      create: { ...pr, vendorId: vendor.id },
    });
    // Seed an initial_stock movement if there isn't one yet so the
    // audit log doesn't open empty.
    const existing = await prisma.stockMovement.findFirst({
      where: { productId: pr.id, reason: 'initial_stock' },
    });
    if (!existing && pr.stockQty > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: pr.id,
          vendorId: vendor.id,
          delta: pr.stockQty,
          resultingQty: pr.stockQty,
          reason: 'initial_stock',
          note: 'Opening balance (seeded)',
        },
      });
    }
  }
  console.log(`   products ${products.length}`);

  // ── 7. Service ↔ Product recipes ───────────────────────────────
  const recipes = [
    // Quick Wash: 1 microfiber + 1 foam soap
    { serviceId: S.quickWash, productId: P.microfiber, qtyPerWash: 1 },
    { serviceId: S.quickWash, productId: P.foamSoap, qtyPerWash: 1 },
    // Full Wash: 2 microfiber + 1 foam + 1 glass
    { serviceId: S.fullWash, productId: P.microfiber, qtyPerWash: 2 },
    { serviceId: S.fullWash, productId: P.foamSoap, qtyPerWash: 1 },
    { serviceId: S.fullWash, productId: P.windowCleaner, qtyPerWash: 1 },
    // Deep Clean: full + wax + tire shine
    { serviceId: S.deepClean, productId: P.microfiber, qtyPerWash: 3 },
    { serviceId: S.deepClean, productId: P.foamSoap, qtyPerWash: 1 },
    { serviceId: S.deepClean, productId: P.wax, qtyPerWash: 1 },
    { serviceId: S.deepClean, productId: P.tireShine, qtyPerWash: 1 },
    { serviceId: S.deepClean, productId: P.windowCleaner, qtyPerWash: 1 },
    // Premium Detail: everything ramps up
    { serviceId: S.premiumDetail, productId: P.microfiber, qtyPerWash: 5 },
    { serviceId: S.premiumDetail, productId: P.foamSoap, qtyPerWash: 2 },
    { serviceId: S.premiumDetail, productId: P.wax, qtyPerWash: 2 },
    { serviceId: S.premiumDetail, productId: P.tireShine, qtyPerWash: 1 },
    { serviceId: S.premiumDetail, productId: P.windowCleaner, qtyPerWash: 2 },
  ];
  // Replace the whole recipe set so re-running stays clean.
  await prisma.serviceProduct.deleteMany({
    where: { serviceId: { in: Object.values(S) } },
  });
  await prisma.serviceProduct.createMany({ data: recipes });
  console.log(`   recipes ${recipes.length}`);

  // ── 8. Supplier ────────────────────────────────────────────────
  await prisma.supplier.upsert({
    where: { id: SUP_ID },
    update: {
      name: 'Gulf Cleaning Supplies LLC',
      contactName: 'Sara Khalifa',
      phone: '+9714555 1234',
      email: 'orders@gulfcleaning.ae',
      notes: 'Lead time: 2 days. Min order AED 500.',
      deletedAt: null,
    },
    create: {
      id: SUP_ID,
      vendorId: vendor.id,
      name: 'Gulf Cleaning Supplies LLC',
      contactName: 'Sara Khalifa',
      phone: '+9714555 1234',
      email: 'orders@gulfcleaning.ae',
      notes: 'Lead time: 2 days. Min order AED 500.',
    },
  });
  console.log('   supplier ok');

  // ── 9. Promotion ───────────────────────────────────────────────
  const now = new Date();
  const in14d = new Date(now.getTime() + 14 * 24 * 3600_000);
  await prisma.promotion.upsert({
    where: { id: PROMO_ID },
    update: {
      name: '10% off any wash',
      code: 'AQUA10',
      type: 'percent',
      value: 10,
      applicableServiceIds: [],
      applicableCarTypes: [],
      minSpendAed: 50,
      startsAt: now,
      endsAt: in14d,
      usageLimit: 500,
      perCustomerLimit: 2,
      autoApplied: false,
      featured: true,
      terms: 'One-time use per customer. Cannot be combined with other offers.',
      status: 'active',
    },
    create: {
      id: PROMO_ID,
      vendorId: vendor.id,
      name: '10% off any wash',
      code: 'AQUA10',
      type: 'percent',
      value: 10,
      applicableServiceIds: [],
      applicableCarTypes: [],
      minSpendAed: 50,
      startsAt: now,
      endsAt: in14d,
      usageLimit: 500,
      perCustomerLimit: 2,
      autoApplied: false,
      featured: true,
      terms: 'One-time use per customer. Cannot be combined with other offers.',
      status: 'active',
    },
  });
  console.log('   promotion AQUA10 ok');

  // ── 10. Sample completed bookings ─────────────────────────────
  // Three walk-in (no customerId) completed bookings spread over the last
  // week — populates the finance dashboard + the loyalty roster stays empty
  // (walk-ins don't get tiered). For named customers we'd need to seed
  // customer users + their car profiles; the script picks walk-ins to
  // keep dependencies tight.
  const sampleBookings = [
    {
      daysAgo: 6,
      serviceId: S.quickWash,
      bayId: B.bay1,
      walkInName: 'Khalid (cash)',
      walkInPhone: '+971501112233',
    },
    {
      daysAgo: 4,
      serviceId: S.fullWash,
      bayId: B.bay2,
      walkInName: 'Hessa',
      walkInPhone: '+971502223344',
    },
    {
      daysAgo: 2,
      serviceId: S.deepClean,
      bayId: B.bay3,
      walkInName: 'Omar',
      walkInPhone: '+971503334455',
    },
    {
      daysAgo: 1,
      serviceId: S.quickWash,
      bayId: B.bay1,
      walkInName: 'Mariam',
      walkInPhone: '+971504445566',
    },
  ];

  for (const sb of sampleBookings) {
    const svc = services.find((s) => s.id === sb.serviceId);
    const slotStart = new Date(now.getTime() - sb.daysAgo * 86_400_000);
    slotStart.setHours(10 + sb.daysAgo, 30, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + svc.durationMin * 60_000);
    const vatAed = Math.round((svc.priceAed * 5) / 105);
    const id = `seed-aqua-booking-${sb.daysAgo}`;

    // Upsert booking + the corresponding invoice number. We re-use the
    // booking id as a stable seed so re-runs update in place.
    const existing = await prisma.booking.findUnique({ where: { id } });
    if (existing) continue; // never re-run invoice numbering

    await prisma.$transaction(async (tx) => {
      const v = await tx.vendor.update({
        where: { id: vendor.id },
        data: { lastInvoiceSeq: { increment: 1 } },
        select: { lastInvoiceSeq: true, brandName: true },
      });
      const prefix = (v.brandName.replace(/[^a-zA-Z]/g, '').slice(0, 3) || 'INV').toUpperCase();
      const invoiceNumber = `${prefix}-${String(v.lastInvoiceSeq).padStart(6, '0')}`;
      await tx.booking.create({
        data: {
          id,
          vendorId: vendor.id,
          bayId: sb.bayId,
          serviceId: sb.serviceId,
          slotStart,
          slotEnd,
          status: 'completed',
          totalAed: svc.priceAed,
          vatAed,
          isWalkIn: true,
          walkInName: sb.walkInName,
          walkInPhone: sb.walkInPhone,
          invoiceNumber,
        },
      });
    });
  }
  console.log(`   sample bookings ${sampleBookings.length}`);

  console.log('');
  console.log('==> Done.');
  console.log(`    Vendor admin login: ${OWNER_EMAIL} (password = the SEED_OWNER_PASSWORD you set)`);
  console.log('    Vendor will appear in customer-app Nearby map at Dubai 25.1325, 55.2294');
  console.log('    Promo code: AQUA10 (10% off, AED 50 min spend, 14 days)');
  console.log('    Low-stock banner will trigger for "Glass Cleaner" (3 / threshold 5)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
