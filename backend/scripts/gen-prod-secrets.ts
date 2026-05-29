// Generates a block of strong production secrets you can paste into your
// secret manager (AWS Secrets Manager / DigitalOcean App Platform env /
// 1Password / etc.). Each run produces fresh values — never reuse the
// development ones, and never commit the output to git.
//
// Usage:
//   npx tsx scripts/gen-prod-secrets.ts
//
// To pipe straight into a temp .env you'll edit and shred:
//   npx tsx scripts/gen-prod-secrets.ts > .env.production.tmp

import crypto from 'node:crypto';

const hex = (bytes: number) => crypto.randomBytes(bytes).toString('hex');
const b64 = (bytes: number) => crypto.randomBytes(bytes).toString('base64url');

const banner = '# ─── Find My Bay — production secrets (generated ' + new Date().toISOString() + ') ───';
const lines = [
  banner,
  '# Paste into your secret manager. Do NOT commit this file.',
  '',
  '# JWT — 64 random bytes (512 bits) hex-encoded; far above the 32-char zod minimum.',
  'JWT_ACCESS_SECRET=' + hex(64),
  'JWT_REFRESH_SECRET=' + hex(64),
  '',
  '# Postgres password — base64url, URL-safe so it works inline in DATABASE_URL.',
  'POSTGRES_PASSWORD=' + b64(24),
  '',
  '# Mock-payment HMAC key (only used when PAYMENT_PROVIDER=mock; harmless on prod',
  '# but rotated anyway).',
  'MOCK_PAYMENT_HMAC=' + hex(32),
  '',
  '# Internal API key for any future service-to-service calls.',
  'INTERNAL_API_KEY=' + b64(32),
];

console.log(lines.join('\n'));
