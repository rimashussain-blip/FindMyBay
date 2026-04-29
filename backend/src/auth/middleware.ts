// Middleware that pulls the Bearer token off Authorization, verifies it,
// and attaches `req.user = { id, role }` for downstream handlers.

import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../lib/error.js';
import { verifyAccessToken } from './jwt.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Missing bearer token', { code: 'auth_missing' }));
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const claims = verifyAccessToken(token);
    if (!claims.sub) throw new Error('no sub claim');
    req.user = { id: claims.sub, role: claims.role };
    next();
  } catch (err) {
    next(new HttpError(401, 'Invalid or expired token', { code: 'auth_invalid' }));
  }
};

/**
 * Gate a route to one of the listed user roles. Always pair with `requireAuth`
 * (which populates `req.user`). For vendor-staff roles use `requireVendor`
 * instead — that one also checks the vendor_members join.
 *
 * Example: `requireAuth, requireRole('admin')` for platform-admin endpoints.
 */
export const requireRole =
  (...allowed: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new HttpError(401, 'Auth required', { code: 'auth_missing' }));
    if (!allowed.includes(req.user.role)) {
      return next(
        new HttpError(403, `Requires role: ${allowed.join(' or ')}`, { code: 'role_forbidden' }),
      );
    }
    next();
  };
