// One-off data repair: restore owner@aquacarwash.ae to the `owner` role.
//
// Background: a bug in the staff invite-accept flow let an owner accept their
// own invite and demote themselves to `attendant`, leaving the vendor with no
// owner. The code bug is fixed separately; this script repairs the data.
//
// Run (DATABASE_URL must point at the target DB):
//   DATABASE_URL=... node backend/scripts/fix-owner-role.js
//
// Idempotent: safe to run more than once.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OWNER_EMAIL = 'owner@aquacarwash.ae';

async function main() {
  const user = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!user) throw new Error(`No user found for ${OWNER_EMAIL}`);

  const members = await prisma.vendorMember.findMany({
    where: { userId: user.id },
    include: { vendor: { select: { id: true, brandName: true } } },
  });
  console.log(`Before — ${members.length} membership(s) for ${OWNER_EMAIL}:`);
  for (const m of members) {
    console.log(`  vendor="${m.vendor.brandName}" role=${m.role} status=${m.status}`);
  }

  const result = await prisma.vendorMember.updateMany({
    where: { userId: user.id },
    data: { role: 'owner', status: 'active' },
  });
  console.log(`Updated ${result.count} membership(s) -> role=owner, status=active`);

  // Keep the global User.role consistent with vendor ownership (used by the
  // JWT role claim and role gating). Harmless if already correct.
  if (user.role !== 'vendor_owner') {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'vendor_owner' } });
    console.log(`User.role ${user.role} -> vendor_owner`);
  }

  const after = await prisma.vendorMember.findMany({
    where: { userId: user.id },
    include: { vendor: { select: { brandName: true } } },
  });
  console.log('After:');
  for (const m of after) {
    console.log(`  vendor="${m.vendor.brandName}" role=${m.role} status=${m.status}`);
  }
}

main()
  .catch((e) => {
    console.error('Repair failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
