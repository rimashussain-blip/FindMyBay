// JWT issuance & verification.
//
// We use two secrets — access (short-lived) and refresh (long-lived). The
// refresh token plaintext is hashed and stored in the DB so we can revoke it.

import jwt, { type SignOptions, type JwtPayload } from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

export interface AccessClaims extends JwtPayload {
  sub: string; // user id
  role: string;
}

export const signAccessToken = (userId: string, role: string): string =>
  jwt.sign({ sub: userId, role } as AccessClaims, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.JWT_ACCESS_TTL_MIN}m`,
  } as SignOptions);

export const verifyAccessToken = (token: string): AccessClaims =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims;

/**
 * Returns { token, hash, expiresAt }. Store the hash in the DB; return the
 * plaintext to the client only once.
 */
export const generateRefreshToken = (): { token: string; hash: string; expiresAt: Date } => {
  const token = crypto.randomBytes(48).toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, hash, expiresAt };
};

export const hashRefreshToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');
