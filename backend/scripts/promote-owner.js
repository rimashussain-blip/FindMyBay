// Maintenance: promote a vendor staff member to `owner` (full access).
//
// Needed when a vendor ends up with no owner (e.g. the only member is an
// attendant and there's no one with permission to promote them). Run with:
//
//   DATABASE_URL=... PROMOTE_EMAIL=user@example.com PROMOTE_VENDOR="Brand Name" \
//     node backend/scripts/promote-owner.js
//
// PROMOTE_VENDOR is optional — if omitted, every membership for that user is
// promoted (fine when the user belongs to a single vendor). Idempotent.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EMAIL = (process.env.PROMOTE_EMAIL || '').trim().toLowerCase();
const VENDOR = (process.env.PROMOTE_VENDOR || '').trim();

async function main() {
  if (!EMAIL) throw new Error('PROMOTE_EMAIL is required');

  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) throw new Error(`No user found for ${EMAIL}`);

  const memberships = await prisma.vendorMember.findMany({
    where: { userId: user.id },
    include: { vendor: { select: { id: true, brandName: true } } },
  });
  if (memberships.length === 0) throw new Error(`${EMAIL} has no vendor memberships`);

  console.log(`Memberships for ${EMAIL}:`);
  for (const m of memberships) {
    console.log(`  vendor="${m.vendor.brandName}" role=${m.role} status=${m.status}`);
  }

  const targets = VENDOR
    ? memberships.filter((m) => m.vendor.brandName.toLowerCase() === VENDOR.toLowerCase())
    : memberships;
  if (targets.length === 0) throw new Error(`No membership matched vendor "${VENDOR}"`);

  for (const m of targets) {
    await prisma.vendorMember.update({
      where: { id: m.id },
      data: { role: 'owner', status: 'active' },
    });
    console.log(`Promoted: vendor="${m.vendor.brandName}" -> role=owner, status=active`);
  }

  // Keep the global User.role aligned so the JWT role claim + gating treat
  // them as vendor staff (not a plain customer).
  if (user.role === 'customer') {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'vendor_owner' } });
    console.log(`User.role customer -> vendor_owner`);
  }
}

main()
  .catch((e) => {
    console.error('Promotion failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
