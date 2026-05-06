// Auth endpoints:
//   POST /auth/otp/request  — issue a new OTP for a phone number
//   POST /auth/otp/verify   — exchange (phone, challengeId, code) for tokens

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { asyncHandler, HttpError } from '../lib/error.js';
import { logger } from '../lib/logger.js';
import { requireAuth } from './middleware.js';
import { loginWithEmail, registerWithEmail, requestOtp, verifyOtp } from './service.js';
import { loginWithGoogle } from './google.js';

export const authRouter = Router();

// E.164-ish: '+' followed by 9–15 digits. Real validation happens client-side too.
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+\d{9,15}$/, 'phone must be E.164 (e.g. +971501234567)');

const requestBody = z.object({ phone: phoneSchema });

const verifyBody = z.object({
  phone: phoneSchema,
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'code must be 6 digits'),
});

authRouter.post(
  '/otp/request',
  asyncHandler(async (req, res) => {
    const { phone } = requestBody.parse(req.body);
    const result = await requestOtp(phone);
    res.json(result);
  }),
);

authRouter.post(
  '/otp/verify',
  asyncHandler(async (req, res) => {
    const { phone, challengeId, code } = verifyBody.parse(req.body);
    const result = await verifyOtp(phone, challengeId, code);
    res.json(result);
  }),
);

// ── Email + password (used by Vendor Admin) ───────────────────────────────

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(80).optional(),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerBody.parse(req.body);
    const result = await registerWithEmail(body);
    res.status(201).json(result);
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginBody.parse(req.body);
    const result = await loginWithEmail(body);
    res.json(result);
  }),
);

// ── Google Sign-In ────────────────────────────────────────────────────────

const googleBody = z.object({
  // Google ID tokens are long; cap at a generous 8KB to bounce abuse cheaply.
  idToken: z.string().min(50).max(8 * 1024),
});

authRouter.post(
  '/google',
  asyncHandler(async (req, res) => {
    const body = googleBody.parse(req.body);
    const result = await loginWithGoogle(body);
    res.json(result);
  }),
);

// ── Current user — used by Profile page ───────────────────────────────────

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw new HttpError(404, 'User not found');
    res.json({
      id: user.id,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      // Customer car profile — Android uses these to decide whether to
      // show the first-run onboarding sheet. profileComplete is the cheap
      // boolean the client actually checks (true once phone + carType +
      // carPlate are all set).
      carMake: user.carMake,
      carType: user.carType,
      carColor: user.carColor,
      carPlate: user.carPlate,
      profileComplete: Boolean(user.phone && user.carType && user.carPlate),
      createdAt: user.createdAt.toISOString(),
    });
  }),
);

// PATCH /auth/me — name + email tweaks. Car profile lives at /auth/me/profile
// so the validation rules can be tighter (phone normalisation, plate format).
const updateMeBody = z.object({
  fullName: z.string().min(1).max(80).optional(),
  email: z.string().email().optional(),
});

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    const body = updateMeBody.parse(req.body);
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        fullName: body.fullName ?? undefined,
        email: body.email?.trim().toLowerCase() ?? undefined,
      },
    });
    res.json({
      id: updated.id,
      phone: updated.phone,
      email: updated.email,
      fullName: updated.fullName,
      role: updated.role,
    });
  }),
);

// ── Customer car profile (first-run onboarding) ──────────────────────────

const CAR_TYPES = ['sedan', 'hatchback', 'suv', 'pickup', 'van', 'coupe', 'other'] as const;

const updateProfileBody = z.object({
  // We accept partial updates so the client can split the flow across
  // screens (mobile + car details first, plate on a second screen) without
  // an all-or-nothing PUT.
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone').optional(),
  carMake: z.string().min(1).max(40).optional(),
  carType: z.enum(CAR_TYPES).optional(),
  carColor: z.string().min(1).max(20).optional(),
  carPlate: z.string().min(1).max(20).optional(),
});

/**
 * PATCH /auth/me/profile
 * Saves the customer's car details captured in the post-Google-sign-in
 * onboarding flow. Idempotent + partial — the Android client posts each
 * step individually and re-uses this endpoint when the user later edits
 * their profile from the settings screen.
 */
authRouter.patch(
  '/me/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    const body = updateProfileBody.parse(req.body);

    // If the customer is claiming a phone, pre-flight against the partial
    // unique index that scopes uniqueness to role='customer' (see migration
    // 20260505000000_phone_unique_per_customer). Vendor staff phones don't
    // collide with customer phones — same human can be both, in two rows.
    //
    // Two outcomes worth handling: (1) the phone is on a stale phone-OTP
    // customer from before Google sign-in shipped — the user has no idea
    // that row exists, so we silently absorb it; (2) the phone is on a
    // real customer account (different Google sub or has bookings) —
    // that's a genuine collision and the client gets a clean 409.
    if (body.phone) {
      const conflict = await prisma.user.findFirst({
        where: { phone: body.phone, role: 'customer' },
        include: {
          _count: { select: { bookings: true, vendorMembers: true } },
        },
      });
      if (conflict && conflict.id !== req.user.id) {
        const isOrphan =
          !conflict.googleSub &&
          !conflict.passwordHash &&
          conflict._count.bookings === 0 &&
          conflict._count.vendorMembers === 0;
        if (isOrphan) {
          await prisma.user.delete({ where: { id: conflict.id } });
          logger.info(
            { absorbedUserId: conflict.id, phone: body.phone },
            'absorbed orphan phone-OTP user during profile claim',
          );
        } else {
          throw new HttpError(409, 'This phone is linked to another account.', {
            code: 'phone_taken',
          });
        }
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        phone: body.phone ?? undefined,
        carMake: body.carMake?.trim() ?? undefined,
        carType: body.carType ?? undefined,
        carColor: body.carColor?.trim() ?? undefined,
        // Normalise plate to upper-case + collapsed whitespace so search /
        // display is consistent regardless of how the customer typed it.
        carPlate: body.carPlate?.trim().toUpperCase().replace(/\s+/g, ' ') ?? undefined,
      },
    });

    res.json({
      id: updated.id,
      phone: updated.phone,
      email: updated.email,
      fullName: updated.fullName,
      role: updated.role,
      carMake: updated.carMake,
      carType: updated.carType,
      carColor: updated.carColor,
      carPlate: updated.carPlate,
      profileComplete: Boolean(updated.phone && updated.carType && updated.carPlate),
    });
  }),
);

// ── PDPL endpoints ────────────────────────────────────────────────────────
//
// UAE Personal Data Protection Law gives residents the right of access
// (export of all data held about them) and the right to erasure. Spec §12
// lists `/me/export` and `/me/delete` as MVP requirements.

/**
 * GET /auth/me/export
 *
 * Returns a JSON dump of every record we hold about the calling user.
 * Sent as an attachment so the customer can save it directly. Does not
 * include payment-method PANs because we never store them — only Telr/NI
 * processor refs.
 */
authRouter.get(
  '/me/export',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    const userId = req.user.id;

    const [user, bookings, reviews, payments, deviceTokens, vendorMembers] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.booking.findMany({
        where: { customerId: userId },
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: { select: { brandName: true, city: true, emirate: true } },
          service: { select: { name: true, durationMin: true, priceAed: true } },
          bay: { select: { name: true } },
        },
      }),
      prisma.review.findMany({
        where: { customerId: userId },
        orderBy: { createdAt: 'desc' },
        // Vendor lives behind booking — Review has no direct vendor relation.
        include: { booking: { include: { vendor: { select: { brandName: true } } } } },
      }),
      prisma.payment.findMany({
        where: { booking: { customerId: userId } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          processor: true,
          amountAed: true,
          status: true,
          paidAt: true,
          createdAt: true,
          bookingId: true,
        },
      }),
      prisma.deviceToken.findMany({
        where: { userId },
        select: { platform: true, lastSeenAt: true, createdAt: true },
      }),
      prisma.vendorMember.findMany({
        where: { userId },
        include: { vendor: { select: { brandName: true } } },
      }),
    ]);
    if (!user) throw new HttpError(404, 'User not found');

    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="findmybay-export-${userId}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      notice:
        'This is your full Find My Bay record under UAE PDPL. Card numbers are not stored — only processor references.',
      profile: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        fullName: user.fullName,
        role: String(user.role),
        createdAt: user.createdAt.toISOString(),
      },
      lastKnownLocation: user.lastLat == null
        ? null
        : {
            lat: user.lastLat,
            lng: user.lastLng,
            reportedAt: user.lastLocationAt?.toISOString() ?? null,
          },
      bookings: bookings.map((b) => ({
        id: b.id,
        status: String(b.status),
        slotStart: b.slotStart.toISOString(),
        slotEnd: b.slotEnd.toISOString(),
        totalAed: b.totalAed,
        vendor: b.vendor,
        service: b.service,
        bay: b.bay,
        createdAt: b.createdAt.toISOString(),
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        note: r.note,
        vendor: r.booking.vendor.brandName,
        createdAt: r.createdAt.toISOString(),
      })),
      payments: payments.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        paidAt: p.paidAt?.toISOString() ?? null,
        status: String(p.status),
      })),
      deviceTokens: deviceTokens.map((d) => ({
        platform: d.platform,
        lastSeenAt: d.lastSeenAt.toISOString(),
        createdAt: d.createdAt.toISOString(),
      })),
      vendorMemberships: vendorMembers.map((v) => ({
        vendor: v.vendor.brandName,
        role: String(v.role),
        joinedAt: v.createdAt.toISOString(),
      })),
    });
    logger.info({ userId }, 'PDPL export delivered');
  }),
);

/**
 * DELETE /auth/me
 *
 * PDPL right to erasure. We can't hard-delete the User row because
 * bookings (vendor revenue records), reviews and payments hold required
 * FKs to customer_id. Instead we scrub PII and tear down auth material:
 *
 *   - phone, email, passwordHash → null
 *   - fullName → "[deleted]"
 *   - lastLat/lng/lastLocationAt → null
 *   - All RefreshTokens, DeviceTokens, OtpChallenges → hard delete
 *
 * Active access tokens stay valid until their 15-min TTL expires; with
 * refresh tokens gone they can't be renewed.
 *
 * Refused if the caller is admin or owns/manages a vendor — those need
 * a hand-over flow we haven't built yet, plus admin self-deletion is a
 * footgun. Their guidance: contact support.
 */
authRouter.delete(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    const userId = req.user.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(404, 'User not found');

    if (user.role === 'admin') {
      throw new HttpError(409, 'Admin accounts cannot self-delete; contact support.', {
        code: 'admin_cannot_self_delete',
      });
    }

    const ownsVendor = await prisma.vendorMember.findFirst({ where: { userId } });
    if (ownsVendor) {
      throw new HttpError(
        409,
        'You belong to a vendor team. Transfer ownership or leave the team before deleting your account.',
        { code: 'has_vendor_membership' },
      );
    }

    const phoneAtTimeOfDeletion = user.phone; // for OtpChallenge cleanup

    await prisma.$transaction(async (tx) => {
      // Tear down anything tied solely to the user.
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.deviceToken.deleteMany({ where: { userId } });
      // OtpChallenges link by phone (not user_id); clean by phone if we have one.
      if (phoneAtTimeOfDeletion) {
        await tx.otpChallenge.deleteMany({ where: { phone: phoneAtTimeOfDeletion } });
      }

      // Scrub PII on the User row. We keep the row so customer_id FKs
      // (bookings, reviews) stay valid; vendor still sees their booking
      // history with an anonymised customer.
      await tx.user.update({
        where: { id: userId },
        data: {
          phone: null,
          email: null,
          passwordHash: null,
          fullName: '[deleted]',
          lastLat: null,
          lastLng: null,
          lastLocationAt: null,
        },
      });
    });

    logger.warn({ userId }, 'PDPL erasure complete: user PII scrubbed');
    res.json({
      ok: true,
      deletedAt: new Date().toISOString(),
      notice:
        'Your personal data has been erased. Booking and review records remain in anonymised form to preserve vendor history. Active sessions will expire within 15 minutes.',
    });
  }),
);
