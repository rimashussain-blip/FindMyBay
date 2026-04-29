// QR check-in token issuance + verification.
//
// The QR encodes a string "fmb://checkin/{bookingId}?t={jwt}" where the JWT
// payload carries { bookingId, vendorId, customerId } signed with a server
// secret and a short expiry centred on the booking's slot.
//
// Signing & verification both happen on the server — the customer's phone
// just renders the string, and the vendor admin POSTs the scanned string
// straight to /admin/checkin. The server is the only place that knows the
// signing secret.

import jwt, { type SignOptions, type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.js';

interface CheckinClaims extends JwtPayload {
  bookingId: string;
  vendorId: string;
  customerId: string;
}

// Use the same access-token secret. In production you'd typically split this
// into its own secret in env.ts; for the MVP we share to keep config small.
const SECRET = env.JWT_ACCESS_SECRET;

/**
 * Token validity: from slot_start - 30 min to slot_start + 1 hour.
 * Outside that window the QR cannot be redeemed.
 */
function checkinValiditySeconds(slotStart: Date): { iat: number; exp: number } {
  const earliest = Math.floor((slotStart.getTime() - 30 * 60_000) / 1000);
  const latest = Math.floor((slotStart.getTime() + 60 * 60_000) / 1000);
  return { iat: earliest, exp: latest };
}

export function issueCheckinToken(input: {
  bookingId: string;
  vendorId: string;
  customerId: string;
  slotStart: Date;
}): string {
  const { iat, exp } = checkinValiditySeconds(input.slotStart);
  const payload: CheckinClaims = {
    bookingId: input.bookingId,
    vendorId: input.vendorId,
    customerId: input.customerId,
    iat,
    exp,
  };
  return jwt.sign(payload, SECRET, { algorithm: 'HS256' } as SignOptions);
}

/**
 * Wraps the JWT in a custom-scheme URL so apps can deep-link the same string
 * back into the customer app for sharing/saving (future feature).
 */
export function buildQrString(input: {
  bookingId: string;
  vendorId: string;
  customerId: string;
  slotStart: Date;
}): string {
  const token = issueCheckinToken(input);
  return `fmb://checkin/${input.bookingId}?t=${token}`;
}

export function verifyCheckinToken(token: string): CheckinClaims {
  // Throws JsonWebTokenError or TokenExpiredError on bad input — caught by
  // the route handler and translated to a 4xx response.
  return jwt.verify(token, SECRET, { algorithms: ['HS256'] }) as CheckinClaims;
}

/** Parse "fmb://checkin/{bookingId}?t={jwt}" into its parts. */
export function parseQrString(s: string): { bookingId: string; token: string } | null {
  const trimmed = s.trim();
  // Accept both fmb:// scheme and plain "{bookingId}?t={jwt}" for raw paste.
  const match = trimmed.match(/^(?:fmb:\/\/checkin\/)?([a-zA-Z0-9_-]+)\?t=(.+)$/);
  if (!match) return null;
  return { bookingId: match[1], token: match[2] };
}
