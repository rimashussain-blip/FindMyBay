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
import { sendEmail } from '../lib/email.js';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from './jwt.js';

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

/**
 * Exchange a still-valid refresh token for a fresh access + refresh pair.
 * Rotates the refresh token (revokes the old hash, issues a new one) so a
 * leaked refresh token has a single-use lifetime.
 *
 * Returns 401 with a stable error code on every failure mode so the iOS /
 * Android clients can decide whether to silently retry or sign-out the user.
 */
export async function refreshSession(presentedToken: string) {
  const tokenHash = hashRefreshToken(presentedToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, role: true } } },
  });

  if (!stored) {
    throw new HttpError(401, 'Refresh token not recognised', { code: 'refresh_invalid' });
  }
  if (stored.revokedAt) {
    throw new HttpError(401, 'Refresh token already used', { code: 'refresh_revoked' });
  }
  if (stored.expiresAt.getTime() < Date.now()) {
    throw new HttpError(401, 'Refresh token expired', { code: 'refresh_expired' });
  }

  // Rotate: revoke old + issue new in a single transaction so a crash midway
  // can't leave both versions valid.
  const fresh = generateRefreshToken();
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: stored.userId,
        tokenHash: fresh.hash,
        expiresAt: fresh.expiresAt,
      },
    }),
  ]);

  const accessToken = signAccessToken(stored.user.id, stored.user.role);
  return { accessToken, refreshToken: fresh.token };
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

  // Fire off the verification email. Don't await — a slow Postmark call
  // shouldn't block the signup response. Failures are logged but don't
  // surface; the SPA exposes a "resend" button.
  sendEmailVerification(user.id).catch((err) => {
    logger.error({ err, userId: user.id }, 'failed to send verification email');
  });

  const tokens = await issueSession(user.id, user.role);
  return {
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

/**
 * Authenticated password change. Used by the first-login "set a new password"
 * step (staff created with a temp password) and any future settings screen.
 * Clears mustChangePassword and revokes other refresh sessions for safety.
 */
export async function changePassword(userId: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8)
    throw new HttpError(400, 'Password must be at least 8 characters', { code: 'weak_password' });
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
  // Invalidate other outstanding refresh tokens — a changed password should
  // not leave old sessions alive.
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  logger.info({ userId }, 'password changed (authenticated)');
}

// ─────────────────────────────────────────────────────────────────────────
//  Password reset + email verification
// ─────────────────────────────────────────────────────────────────────────

// Tokens are 32 random bytes (= 256 bits) base64url-encoded. Stored as
// SHA-256 hashes — the plaintext only exists in the email link.
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function mintToken(): { plain: string; hash: string } {
  const plain = crypto.randomBytes(32).toString('base64url');
  const hash = crypto.createHash('sha256').update(plain).digest('hex');
  return { plain, hash };
}

function hashToken(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

function vendorAdminUrl(): string {
  // Falls back to a relative path if VENDOR_ADMIN_URL is unset, so dev
  // works without any extra env var. Same approach as the staff invite
  // URL builder.
  return env.VENDOR_ADMIN_URL?.replace(/\/+$/, '') ?? '';
}

/**
 * Step 1 of password reset: user submits their email. We respond with 200
 * regardless of whether the email is known, to avoid leaking which addresses
 * have accounts. The token is sent only if the email exists AND the user has
 * a passwordHash (Google/Apple-only users can't reset what they don't have).
 */
export async function requestPasswordReset(emailRaw: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // Bail silently if the email is unknown OR the user has no password.
  // Don't expose either condition to the caller — both yield 200 / "ok".
  if (!user || !user.passwordHash) {
    logger.info({ email }, 'password-reset requested for unknown/passwordless email — silently dropped');
    return;
  }

  // Invalidate any prior unconsumed tokens for this user so the latest
  // email is the only working one. (Optional but reduces phishing
  // surface — a freshly-issued token can't be stomped by an older one
  // that someone else captured.)
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const { plain, hash } = mintToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    },
  });

  const link = `${vendorAdminUrl()}/reset-password/${plain}`;
  await sendEmail({
    to: email,
    subject: 'Reset your Find My Bay password',
    tag: 'password-reset',
    text:
      `Hi${user.fullName ? ` ${user.fullName}` : ''},\n\n` +
      `Use this link to set a new password. It expires in 1 hour and works once:\n\n${link}\n\n` +
      `If you didn't request this, you can safely ignore this email — your password won't change.\n\n` +
      `— Find My Bay`,
  });
}

/**
 * Step 2 of password reset: user clicks the link, picks a new password.
 * Token must match an unconsumed, unexpired row; on success we update the
 * password hash + consume the token + invalidate ALL refresh tokens (other
 * sessions get logged out, which is the desired behaviour for a reset).
 * Returns fresh tokens so the SPA can keep the user signed in.
 */
export async function completePasswordReset(input: {
  token: string;
  newPassword: string;
  ip?: string | null;
}) {
  if (input.newPassword.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters', { code: 'weak_password' });
  }

  const stored = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
    include: { user: true },
  });
  if (!stored) {
    throw new HttpError(400, 'This reset link is invalid', { code: 'token_invalid' });
  }
  if (stored.consumedAt) {
    throw new HttpError(400, 'This reset link has already been used', { code: 'token_consumed' });
  }
  if (stored.expiresAt.getTime() < Date.now()) {
    throw new HttpError(400, 'This reset link has expired — request a new one', {
      code: 'token_expired',
    });
  }

  const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: stored.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: stored.id },
      data: { consumedAt: new Date(), consumedIp: input.ip ?? null },
    }),
    // Sign out every existing session. Forces other devices to re-login
    // with the new password — important if the reset was triggered by a
    // suspected account takeover.
    prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  logger.info({ userId: stored.userId }, 'password reset completed');

  // Issue a fresh session so the user lands signed in after reset.
  const tokens = await issueSession(stored.user.id, stored.user.role);
  return {
    ...tokens,
    user: {
      id: stored.user.id,
      email: stored.user.email,
      phone: stored.user.phone,
      fullName: stored.user.fullName,
      role: stored.user.role,
    },
  };
}

/**
 * Issue a fresh email-verification token for the caller's current email.
 * No-op (returns void) if the email is already verified — callers don't
 * need to know.
 */
export async function sendEmailVerification(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, 'User not found');
  if (!user.email) {
    throw new HttpError(409, 'No email on file for this account', { code: 'no_email' });
  }
  if (user.emailVerifiedAt) {
    // Already verified — silently no-op so the SPA can call this on
    // mount without first checking the flag.
    return;
  }

  // Invalidate prior tokens for the same user/email so only the latest
  // link works.
  await prisma.emailVerification.updateMany({
    where: { userId, email: user.email, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const { plain, hash } = mintToken();
  await prisma.emailVerification.create({
    data: {
      userId,
      email: user.email,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
    },
  });

  const link = `${vendorAdminUrl()}/verify-email/${plain}`;
  await sendEmail({
    to: user.email,
    subject: 'Verify your Find My Bay email',
    tag: 'email-verify',
    text:
      `Hi${user.fullName ? ` ${user.fullName}` : ''},\n\n` +
      `Confirm this is your email so we can reach you about bookings + receipts:\n\n${link}\n\n` +
      `The link is valid for 7 days. If you didn't expect this email, you can ignore it.\n\n` +
      `— Find My Bay`,
  });
}

/**
 * Consume a verification token. On success, flips User.emailVerifiedAt.
 * Validates that the token's snapshotted email still matches the user's
 * current email — if the user changed their email after the token was
 * issued, the token verifies the OLD address (which they no longer have).
 */
export async function consumeEmailVerification(token: string): Promise<{ email: string }> {
  const stored = await prisma.emailVerification.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!stored) {
    throw new HttpError(400, 'This verification link is invalid', { code: 'token_invalid' });
  }
  if (stored.consumedAt) {
    throw new HttpError(400, 'This link has already been used', { code: 'token_consumed' });
  }
  if (stored.expiresAt.getTime() < Date.now()) {
    throw new HttpError(400, 'This verification link has expired — request a new one', {
      code: 'token_expired',
    });
  }
  if (stored.user.email !== stored.email) {
    throw new HttpError(409, 'Your email has changed since this link was sent', {
      code: 'email_changed',
    });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: stored.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerification.update({
      where: { id: stored.id },
      data: { consumedAt: new Date() },
    }),
  ]);

  logger.info({ userId: stored.userId, email: stored.email }, 'email verified');
  return { email: stored.email };
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
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      mustChangePassword: user.mustChangePassword,
    },
  };
}
