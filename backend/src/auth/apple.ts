// Sign in with Apple: verify the identity token from the iOS client and
// find-or-create the matching User. Used by POST /auth/apple.
//
// Identity matching priority (mirrors google.ts):
//   1. appleSub on an existing user → log them in.
//   2. email match on an existing user with no appleSub yet → link Apple
//      to that user.
//   3. email match with a different appleSub → reject (409).
//   4. No match → create a new user with role=customer.
//
// Issues the same JWT pair as /auth/otp/verify and /auth/google.
//
// Note on email: Apple only returns email on the FIRST sign-in. On every
// subsequent sign-in the identity token still carries the email claim (we
// rely on it for linking), but the iOS client only forwards `fullName`
// once. We tolerate either order.

import { createHash } from 'node:crypto';
import appleSignin, { type AppleIdTokenType } from 'apple-signin-auth';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { HttpError } from '../lib/error.js';
import { logger } from '../lib/logger.js';
import { generateRefreshToken, signAccessToken } from './jwt.js';

/// The list of bundle IDs whose Apple-signed tokens we trust. Token's
/// `aud` claim must match ONE of these. Falsy entries are filtered so
/// unset env vars don't accidentally count as a wildcard.
function acceptedAudiences(): string[] {
  return [
    env.APPLE_BUNDLE_ID,
    env.APPLE_BUNDLE_ID_DEBUG,
  ].filter((s): s is string => Boolean(s));
}

export interface AppleLoginInput {
  /// JWT identity token from the iOS `ASAuthorizationAppleIDCredential`.
  idToken: string;
  /// Raw nonce we generated for the request; Apple signs the SHA-256 of
  /// this into the token's `nonce` claim. Optional but recommended.
  nonce?: string | null;
  /// Apple only hands us the user's name on the FIRST sign-in. The iOS
  /// client forwards it for us to persist if we don't have one already.
  fullName?: string | null;
}

export async function loginWithApple(input: AppleLoginInput) {
  if (acceptedAudiences().length === 0) {
    throw new HttpError(501, 'Sign in with Apple is not configured on this server', {
      code: 'apple_disabled',
    });
  }

  // The token's `nonce` claim is the SHA-256 hex of the raw nonce the iOS
  // client generated. `apple-signin-auth` compares whatever we pass as
  // `options.nonce` against that claim with plain string equality (no
  // hashing). So we hash here — if the client included a raw nonce.
  //
  // Skip the check entirely if the client didn't send one (e.g. legacy or
  // server-to-server flows). Apple's other claims (iss, aud, exp, signature)
  // are still verified — losing nonce only removes replay protection.
  const expectedNonceHash = input.nonce
    ? createHash('sha256').update(input.nonce).digest('hex')
    : undefined;

  // verifyIdToken pulls Apple's public keys from
  // https://appleid.apple.com/auth/keys, checks signature, iss, aud, exp,
  // and (when provided) nonce. The library handles JWKS caching for us.
  let payload: AppleIdTokenType;
  try {
    payload = await appleSignin.verifyIdToken(input.idToken, {
      audience: acceptedAudiences(),
      nonce: expectedNonceHash,
      ignoreExpiration: false,
    });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Apple ID token verification failed');
    throw new HttpError(401, 'Sign in with Apple failed', { code: 'apple_token_invalid' });
  }

  if (!payload.sub) {
    throw new HttpError(401, 'Sign in with Apple failed', { code: 'apple_token_no_sub' });
  }

  const appleSub = payload.sub;
  // Apple verifies the email on its end; we trust the claim. Hide-My-Email
  // addresses are still real, deliverable inboxes that route to the user.
  const email = payload.email?.toLowerCase().trim() ?? null;
  const fullName = (input.fullName ?? '').trim() || null;

  // 1) Match by appleSub.
  let user = await prisma.user.findUnique({ where: { appleSub } });

  // 2) Otherwise match by email and link.
  if (!user && email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      if (byEmail.appleSub && byEmail.appleSub !== appleSub) {
        throw new HttpError(409, 'This email is already linked to another Apple account', {
          code: 'apple_email_conflict',
        });
      }
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          appleSub,
          fullName: byEmail.fullName ?? fullName,
        },
      });
      logger.info({ userId: user.id, email }, 'linked Apple account to existing user');
    }
  }

  // 3) Otherwise create.
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        appleSub,
        fullName,
        role: 'customer',
      },
    });
    logger.info({ userId: user.id, email }, 'created new user via Apple sign-in');
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
      carMake: user.carMake,
      carType: user.carType,
      carColor: user.carColor,
      carPlate: user.carPlate,
      profileComplete: Boolean(user.phone && user.carType && user.carPlate),
    },
  };
}
