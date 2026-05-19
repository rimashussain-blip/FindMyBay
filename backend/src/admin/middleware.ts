// Authorize the request as a vendor staff member. Looks up the current user's
// vendor_members row and attaches `req.vendor = { id, role }` for handlers.

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { HttpError } from '../lib/error.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      vendor?: { id: string; role: 'owner' | 'manager' | 'attendant' };
    }
  }
}

export const requireVendor =
  (...allowedRoles: ('owner' | 'manager' | 'attendant')[]) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) return next(new HttpError(401, 'Auth required', { code: 'auth_missing' }));

    const member = await prisma.vendorMember.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'asc' },
    });
    if (!member) {
      return next(
        new HttpError(403, 'You are not registered as vendor staff', { code: 'not_vendor_staff' }),
      );
    }
    // Soft-suspended staff can sign in but can't use any vendor-admin
    // endpoints. The owner reactivates them from Staff settings.
    if (member.status === 'suspended') {
      return next(
        new HttpError(403, 'Your access has been suspended. Contact the vendor owner.', {
          code: 'vendor_member_suspended',
        }),
      );
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(member.role as 'owner' | 'manager' | 'attendant')) {
      return next(
        new HttpError(403, `Requires one of: ${allowedRoles.join(', ')}`, { code: 'role_forbidden' }),
      );
    }
    req.vendor = { id: member.vendorId, role: member.role as 'owner' | 'manager' | 'attendant' };
    next();
  };
