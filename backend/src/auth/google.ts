// Google Sign-In: verify the ID token from the Android app and find-or-create
// the matching User. Used by POST /auth/google.
//
// Identity matching priority (in order):
//   1. googleSub on an existing user → log them in (Google sub is stable
//      across email changes at Google's end).
//   2. email match on an existing user with no googleSub yet → link Google
//      to that user by setting googleSub.
//   3. email match on an existing user that ALREADY has a different googleSub
//      → reject. Either email collision or account hijack attempt; we don't
//      auto-resolve.
//   4. No match at all → create a new user with role=customer.
//
// Issues the same JWT pair as /auth/otp/verify so client navigation is shared.

import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { HttpError } from '../lib/error.js';
import { logger } from '../lib/logger.js';
import { generateRefreshToken, signAccessToken } from './jwt.js';

let cachedClient: OAuth2Client | null = null;
function getClient(): OAuth2Client {
  if (!env.GOOGLE_OAUTH_CLIENT_ID) {
    throw new HttpError(501, 'Google Sign-In is not configured on this server', {
      code: 'google_disabled',
    });
  }
  if (!cachedClient) cachedClient = new OAuth2Client(env.GOOGLE_OAUTH_CLIENT_ID);
  return cachedClient;
}

export interface GoogleLoginInput {
  /** ID token from the Android client's GoogleSignInAccount.getIdToken(). */
  idToken: string;
}

export async function loginWithGoogle(input: GoogleLoginInput) {
  const client = getClient();

  // verifyIdToken handles JWKs fetch + signature check + iss + exp + aud.
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: input.idToken,
      audience: env.GOOGLE_OAUTH_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Google ID token verification failed');
    throw new HttpError(401, 'Google sign-in failed', { code: 'google_token_invalid' });
  }

  if (!payload || !payload.sub) {
    throw new HttpError(401, 'Google sign-in failed', { code: 'google_token_no_sub' });
  }
  if (payload.email_verified !== true) {
    // We only accept verified Google emails — otherwise an attacker could
    // claim someone else's email at Google's end without owning it.
    throw new HttpError(401, 'Google account email is not verified', {
      code: 'google_email_unverified',
    });
  }

  const googleSub = payload.sub;
  const email = payload.email?.toLowerCase().trim() ?? null;
  const fullName = payload.name?.trim() || null;

  // Match by sub first (stable), fall back to email.
  let user = await prisma.user.findUnique({ where: { googleSub } });
  if (!user && email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      if (byEmail.googleSub && byEmail.googleSub !== googleSub) {
        // Email is held by a different Google identity. Refuse to silently
        // re-link — likely indicates a data issue or hijack attempt.
        throw new HttpError(409, 'This email is already linked to another Google account', {
          code: 'google_email_conflict',
        });
      }
      // First-time Google sign-in for an existing user (e.g. one who signed
      // up via email/password). Link the Google account.
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { googleSub, fullName: byEmail.fullName ?? fullName },
      });
      logger.info({ userId: user.id, email }, 'linked Google account to existing user');
    }
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        googleSub,
        fullName,
        // No password — Google is the only auth method on this account.
        role: 'customer',
      },
    });
    logger.info({ userId: user.id, email }, 'created new user via Google sign-in');
  }

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
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      // Forward the car-profile flag so the Android client can route to
      // the onboarding screen instead of the map on first sign-in.
      carMake: user.carMake,
      carType: user.carType,
      carColor: user.carColor,
      carPlate: user.carPlate,
      profileComplete: Boolean(user.phone && user.carType && user.carPlate),
    },
  };
}
