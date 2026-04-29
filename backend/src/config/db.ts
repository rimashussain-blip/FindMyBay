// A single shared Prisma client. Importing this from many modules is fine —
// Prisma manages a connection pool internally.

import { PrismaClient } from '@prisma/client';
import { env, isDev } from './env.js';

export const prisma = new PrismaClient({
  log: isDev ? ['query', 'warn', 'error'] : ['warn', 'error'],
  datasources: { db: { url: env.DATABASE_URL } },
});

// Graceful shutdown so the pool drains before the process exits.
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
