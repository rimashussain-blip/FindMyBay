// OTP request + verify business logic.
//
// Dev-mode OTP delivery: log the code to the console (loud + clear).
// Prod: send via Unifonic / Etisalat SMS (TODO).

import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../config/db.js';
import { env, isDev } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { HttpError } from '../lib/error.js';
import { generateRefreshToken, signAccessToken } from './jwt.js';

const BCRYPT_ROUNDS = 10;
// Magic code that auto-verifies any phone in dev. Saves chasing server logs
// during demos/testing. Only honoured when NODE_ENV=development.
const DEV_BYPASS_CODE = '000000';

const hashCode = (code: string) => crypto.createHash('sha256').update(code).digest('hex');

const sixDigitCode = (): string => {
  // crypto.randomInt is uniformly distributed; avoid Math.random for codes.
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
};

const deliver = async (phone: string, code: string) => {
  switch (env.OTP_DELIVERY) {
    case 'console':
      // Bright + obvious so it's easy to spot in dev logs.
      logger.info(
        `\n  ┌──────────────────────────────────────────────┐\n` +
          `  │  📱  OTP for ${phone.padEnd(16)} →  ${code}      │\n` +
          `  │  (Dev mode: not actually sent via SMS.)      │\n` +
          `  └──────────────────────────────────────────────┘\n`,
      );
      break;
    case 'unifonic':
      // TODO: integrate Unifonic. Throw for now so we don't silently swallow.
      throw new HttpError(501, 'Unifonic SMS delivery not yet implemented');
    default:
      throw new HttpError(500, `Unknown OTP_DELIVERY: ${env.OTP_DELIVERY as string}`);
  }
};

/**
 * Create a new OTP challenge for a phone number. Rate-limit: only one
 * unconsumed challenge can exist per phone within the cooldown window.
 */
export async function requestOtp(phone: string): Promise<{ challengeId: string; resendInSec: number }> {
  // Cooldown: don't issue a new code if we just sent one.
  const cooldownAgo = new Date(Date.now() - env.OTP_RESEND_COOLDOWN_SEC * 1000);
  const recent = await prisma.otpChallenge.findFirst({
    where: { phone, createdAt: { gte: cooldownAgo }, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    const secsSince = Math.floor((Date.now() - recent.createdAt.getTime()) / 1000);
    const remaining = Math.max(env.OTP_RESEND_COOLDOWN_SEC - secsSince, 1);
    throw new HttpError(429, `Please wait ${remaining}s before requesting another code`, {
      code: 'otp_cooldown',
    });
  }

  const code = sixDigitCode();
  const challenge = await prisma.otpChallenge.create({
    data: {
      phone,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + env.OTP_TTL_MIN * 60 * 1000),
    },
  });
  await deliver(phone, code);
  return { challengeId: challenge.id, resendInSec: env.OTP_RESEND_COOLDOWN_SEC };
}

/**
 * Verify a code against an open challenge, create-or-find the user, issue
 * tokens. Increments attempt counter on failure; bails out after MAX_ATTEMPTS.
 */
export async function verifyOtp(phone: string, challengeId: string, code: string) {
  const challenge = await prisma.otpChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.phone !== phone) {
    throw new HttpError(400, 'Invalid challenge', { code: 'otp_invalid_challenge' });
  }
  if (challenge.consumedAt) {
    throw new HttpError(400, 'This code has already been used', { code: 'otp_consumed' });
  }
  if (challenge.expiresAt < new Date()) {
    throw new HttpError(400, 'This code has expired — request a new one', { code: 'otp_expired' });
  }
  if (challenge.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw new HttpError(429, 'Too many attempts on this code', { code: 'otp_too_many_attempts' });
  }

  // Dev shortcut: 000000 always passes. Skipped in production.
  const isDevBypass = isDev && code === DEV_BYPASS_CODE;
  if (!isDevBypass && challenge.codeHash !== hashCode(code)) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: challenge.attempts + 1 },
    });
    throw new HttpError(400, 'Incorrect code', { code: 'otp_wrong_code' });
  }
  if (isDevBypass) {
    logger.warn({ phone }, '🔓 dev OTP bypass — code 000000 accepted');
  }

  // Mark the challenge consumed so the same code can't be replayed.
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  // Find or create the customer user. Phone uniqueness is partial (only
  // among role='customer'); we can't use upsert by phone anymore since
  // there's no globally unique key. The query is scoped to customers so a
  // vendor_owner with the same phone (set as contact info during platform
  // onboarding) is correctly ignored and a fresh customer row is created.
  let user = await prisma.user.findFirst({ where: { phone, role: 'customer' } });
  if (!user) {
    user = await prisma.user.create({
      data: { phone, role: 'customer' },
    });
  }

  // Issue tokens.
  const accessToken = signAccessToken(user.id, user.role);
  const refresh = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: refresh.hash, expiresAt: refresh.expiresAt },
  });

  return {
    accessToken,
    refreshToken: refresh.token,
    user: {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName ?? null,
      role: user.role,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  Email + password (used by Vendor Admin SPA)
// ─────────────────────────────────────────────────────────────────────────

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function issueSession(userId: string, role: string) {
  const accessToken = signAccessToken(userId, role);
  const refresh = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId, tokenHash: refresh.hash, expiresAt: refresh.expiresAt },
  });
  return { accessToken, refreshToken: refresh.token };
}

export async function registerWithEmail(input: {
  email: string;
  password: string;
  fullName?: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (!VALID_EMAIL.test(email))
    throw new HttpError(400, 'Enter a valid email', { code: 'invalid_email' });
  if (input.password.length < 8)
    throw new HttpError(400, 'Password must be at least 8 characters', { code: 'weak_password' });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    throw new HttpError(409, 'An account with this email already exists', { code: 'email_taken' });

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: input.fullName?.trim() || null,
    },
  });

  logger.info({ userId: user.id, email }, 'user registered with email');
  const tokens = await issueSession(user.id, user.role);
  return {
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
    },
  };
}

export async function loginWithEmail(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (!VALID_EMAIL.test(email))
    throw new HttpError(400, 'Enter a valid email', { code: 'invalid_email' });

  const user = await prisma.user.findUnique({ where: { email } });
  // Use bcrypt.compare against a known-bad hash even when user is missing,
  // so the response time doesn't leak whether the account exists.
  const hash = user?.passwordHash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinval';
  const ok = await bcrypt.compare(input.password, hash);
  if (!user || !user.passwordHash || !ok) {
    throw new HttpError(401, 'Email or password is incorrect', { code: 'invalid_credentials' });
  }

  const tokens = await issueSession(user.id, user.role);
  return {
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
    },
  };
}
