// Standalone "create platform admin" script — non-destructive.
//
// Usage:
//   npx tsx prisma/scripts/create-admin.ts                          # uses defaults
//   npx tsx prisma/scripts/create-admin.ts you@findmybay.ae secretA # custom
//
// Idempotent: if the email already exists, the user is upgraded to role=admin
// and the password is reset. Safe to re-run.

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const DEFAULT_EMAIL = 'admin@findmybay.ae';
const DEFAULT_PASSWORD = 'fmb-admin-2026';

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] ?? DEFAULT_EMAIL).trim().toLowerCase();
  const password = process.argv[3] ?? DEFAULT_PASSWORD;

  if (password.length < 8) {
    console.error('❌ Password must be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: 'admin',
      passwordHash,
      fullName: (await prisma.user.findUnique({ where: { email } }))?.fullName ?? 'Platform Admin',
    },
    create: {
      email,
      passwordHash,
      role: 'admin',
      fullName: 'Platform Admin',
    },
  });

  console.log('');
  console.log('✅ Platform admin ready.');
  console.log('   Email:    ' + user.email);
  console.log('   Password: ' + password);
  console.log('   Role:     ' + user.role);
  console.log('   User ID:  ' + user.id);
  console.log('');
  console.log('Sign in at http://localhost:5173/login — you’ll land on /platform/vendors.');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
