// Maintenance: directly add a staff member to a vendor (owner-side add, no
// invite link). Creates the user account with a temp password if needed,
// upserts the vendor membership, and marks any matching pending invite
// accepted so it leaves the Pending list.
//
// Usage:
//   DATABASE_URL=... ADD_EMAIL=person@x.com ADD_VENDOR="Brand" ADD_ROLE=attendant \
//     [ADD_NAME="Full Name"] [ADD_PASSWORD=...] node backend/scripts/add-staff.js
//
// If ADD_PASSWORD is omitted, a strong temp password is generated and printed.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = new PrismaClient();

const EMAIL = (process.env.ADD_EMAIL || '').trim().toLowerCase();
const NAME = (process.env.ADD_NAME || '').trim() || null;
const VENDOR = (process.env.ADD_VENDOR || '').trim();
const ROLE = (process.env.ADD_ROLE || 'attendant').trim();
let PASSWORD = process.env.ADD_PASSWORD || '';

async function main() {
  if (!EMAIL || !VENDOR) throw new Error('ADD_EMAIL and ADD_VENDOR are required');
  if (!['owner', 'manager', 'attendant'].includes(ROLE)) throw new Error(`bad ADD_ROLE: ${ROLE}`);

  const vendor = await prisma.vendor.findFirst({ where: { brandName: VENDOR } });
  if (!vendor) throw new Error(`No vendor "${VENDOR}"`);

  const globalRole = ROLE === 'owner' ? 'vendor_owner' : ROLE === 'manager' ? 'vendor_manager' : 'attendant';

  let user = await prisma.user.findUnique({ where: { email: EMAIL } });
  let tempShown = PASSWORD || '(existing account — password unchanged)';
  if (!user) {
    if (!PASSWORD) PASSWORD = 'Fmb' + crypto.randomBytes(5).toString('hex') + '!';
    tempShown = PASSWORD;
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    user = await prisma.user.create({
      data: { email: EMAIL, passwordHash, fullName: NAME, role: globalRole, emailVerifiedAt: new Date() },
    });
    console.log(`Created user ${EMAIL}`);
  } else if (PASSWORD) {
    // Existing account + an explicit password => reset it so the owner can
    // hand the teammate working credentials.
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    tempShown = PASSWORD;
    console.log(`User ${EMAIL} exists — password reset`);
  } else {
    console.log(`User ${EMAIL} already exists — reusing (password unchanged)`);
  }

  const existing = await prisma.vendorMember.findFirst({ where: { userId: user.id, vendorId: vendor.id } });
  if (existing) {
    await prisma.vendorMember.update({ where: { id: existing.id }, data: { role: ROLE, status: 'active' } });
    console.log(`Updated membership -> role=${ROLE} status=active`);
  } else {
    await prisma.vendorMember.create({ data: { userId: user.id, vendorId: vendor.id, role: ROLE, status: 'active' } });
    console.log(`Created membership role=${ROLE} status=active`);
  }

  const pend = await prisma.staffInvite.updateMany({
    where: { vendorId: vendor.id, email: EMAIL, status: 'pending' },
    data: { status: 'accepted', acceptedAt: new Date(), acceptedById: user.id },
  });
  console.log(`Cleared ${pend.count} pending invite(s)`);

  console.log(`\n===== HAND THESE TO ${EMAIL} =====`);
  console.log(`Sign in:  https://admin.findmybay.me`);
  console.log(`Email:    ${EMAIL}`);
  console.log(`Password: ${tempShown}`);
  console.log(`Role:     ${ROLE} @ ${VENDOR}`);
}
main()
  .catch((e) => { console.error('add-staff failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
