// Auth endpoints:
//   POST /auth/otp/request  — issue a new OTP for a phone number
//   POST /auth/otp/verify   — exchange (phone, challengeId, code) for tokens

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { asyncHandler, HttpError } from '../lib/error.js';
import { requireAuth } from './middleware.js';
import { loginWithEmail, registerWithEmail, requestOtp, verifyOtp } from './service.js';

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
      createdAt: user.createdAt.toISOString(),
    });
  }),
);

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
