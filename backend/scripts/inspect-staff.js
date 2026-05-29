// Read-only diagnostic: dump vendors matching a name + a user's memberships.
// Usage: DATABASE_URL=... INSPECT_VENDOR="Adam" INSPECT_EMAIL=person@x.com node backend/scripts/inspect-staff.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VENDOR = process.env.INSPECT_VENDOR || 'Adam';
const EMAIL = (process.env.INSPECT_EMAIL || '').trim().toLowerCase();

async function main() {
  const vendors = await prisma.vendor.findMany({ where: { brandName: { contains: VENDOR } } });
  console.log(`Vendors matching "${VENDOR}": ${vendors.length}`);
  for (const v of vendors) {
    console.log(`\n=== ${v.brandName} (${v.id}) ===`);
    const members = await prisma.vendorMember.findMany({
      where: { vendorId: v.id },
      include: { user: { select: { email: true } } },
    });
    console.log(`  Members (${members.length}):`);
    for (const m of members) console.log(`    ${m.user.email} — ${m.role}/${m.status}`);
    const invites = await prisma.staffInvite.findMany({ where: { vendorId: v.id }, orderBy: { createdAt: 'desc' } });
    console.log(`  Invites (${invites.length}):`);
    for (const i of invites) console.log(`    ${i.email} — ${i.role}/${i.status}`);
  }

  if (EMAIL) {
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    if (!user) { console.log(`\nNo user ${EMAIL}`); return; }
    const ms = await prisma.vendorMember.findMany({
      where: { userId: user.id },
      include: { vendor: { select: { brandName: true, id: true } } },
    });
    console.log(`\n${EMAIL} (user ${user.id}, role=${user.role}) memberships (${ms.length}):`);
    for (const m of ms) console.log(`    ${m.vendor.brandName} (${m.vendor.id}) — ${m.role}/${m.status}`);
  }
}
main()
  .catch((e) => { console.error('inspect failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
