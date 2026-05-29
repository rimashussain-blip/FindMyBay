// Platform-admin endpoints for vendor onboarding and approval.
//
// All routes require requireAuth + requireRole('admin'). The vendor-admin SPA
// (used by vendor staff) does NOT call these — they're meant for the future
// platform-admin UI plus curl-based onboarding during the pilot.
//
// Today this lets platform admins:
//   1. List all vendors (any status)
//   2. Create a new vendor in `pending` status, with an owner User wired up
//   3. Flip a vendor between pending → active → suspended

import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { asyncHandler, HttpError } from '../lib/error.js';
import { logger } from '../lib/logger.js';
import { requireAuth, requireRole } from '../auth/middleware.js';

export const platformRouter = Router();

const BCRYPT_ROUNDS = 10;

// ── List vendors ─────────────────────────────────────────────────────────

platformRouter.get(
  '/vendors',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const vendors = await prisma.vendor.findMany({
      where: { deletedAt: null },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        members: {
          where: { role: 'owner' },
          include: { user: { select: { id: true, email: true, phone: true, fullName: true } } },
        },
        _count: { select: { bays: true, services: true, bookings: true } },
      },
    });
    res.json({
      items: vendors.map((v) => ({
        id: v.id,
        brandName: v.brandName,
        status: String(v.status),
        emirate: String(v.emirate),
        city: v.city,
        addressLine: v.addressLine,
        tradeLicenseNo: v.tradeLicenseNo,
        ratingAvg: v.ratingAvg,
        owner: v.members[0]
          ? {
              id: v.members[0].user.id,
              email: v.members[0].user.email,
              phone: v.members[0].user.phone,
              fullName: v.members[0].user.fullName,
            }
          : null,
        counts: v._count,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  }),
);

// ── Create vendor + owner ────────────────────────────────────────────────

const createVendorBody = z.object({
  brandName: z.string().min(1).max(120),
  city: z.string().min(1).max(80),
  emirate: z.enum(['AbuDhabi', 'Dubai', 'Sharjah', 'Ajman', 'UmmAlQuwain', 'RasAlKhaimah', 'Fujairah']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  addressLine: z.string().max(200).optional(),
  tradeLicenseNo: z.string().max(80).optional(),
  // Owner can be created from scratch (email + name) or linked from an
  // existing user (ownerUserId). If both are provided ownerUserId wins.
  ownerEmail: z.string().email().optional(),
  ownerFullName: z.string().min(1).max(120).optional(),
  ownerUserId: z.string().min(1).optional(),
});

/**
 * POST /admin/platform/vendors
 *
 * Atomically creates a vendor in `pending`, plus the owner User if they
 * don't already exist, plus the vendor_members link. If the owner is brand
 * new, returns a temp password the platform admin should hand off to the
 * vendor's owner — they can change it on first login.
 */
platformRouter.post(
  '/vendors',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = createVendorBody.parse(req.body);
    if (!body.ownerUserId && !body.ownerEmail) {
      throw new HttpError(400, 'Provide either ownerUserId or ownerEmail', {
        code: 'owner_required',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      let owner;
      let tempPassword: string | undefined;

      if (body.ownerUserId) {
        owner = await tx.user.findUnique({ where: { id: body.ownerUserId } });
        if (!owner) throw new HttpError(404, 'Owner user not found', { code: 'owner_not_found' });
      } else {
        const email = body.ownerEmail!.trim().toLowerCase();
        owner = await tx.user.findUnique({ where: { email } });
        if (!owner) {
          tempPassword = generateTempPassword();
          owner = await tx.user.create({
            data: {
              email,
              fullName: body.ownerFullName ?? null,
              passwordHash: await bcrypt.hash(tempPassword, BCRYPT_ROUNDS),
              role: 'vendor_owner',
            },
          });
        } else if (owner.role === 'customer') {
          // The email is already on a customer account. Refuse to mutate
          // their role (they'd lose their customer identity, bookings, etc).
          // Since email is globally unique, the platform admin must onboard
          // this vendor with a different email. The same human can still be
          // both — they just need separate addresses for each role.
          throw new HttpError(409, 'This email is already a customer account. Use a different email for the vendor owner.', {
            code: 'email_is_customer',
          });
        }
      }

      // Create the PostGIS geometry alongside lat/lng so spatial queries work.
      // Vendor.geom is an Unsupported column in the Prisma schema; we set it
      // via raw SQL inside the same transaction.
      const vendor = await tx.vendor.create({
        data: {
          brandName: body.brandName,
          city: body.city,
          emirate: body.emirate,
          lat: body.lat,
          lng: body.lng,
          addressLine: body.addressLine ?? null,
          tradeLicenseNo: body.tradeLicenseNo ?? null,
          status: 'pending',
        },
      });
      await tx.$executeRaw`
        UPDATE vendors
           SET geom = ST_SetSRID(ST_MakePoint(${body.lng}, ${body.lat}), 4326)
         WHERE id = ${vendor.id}
      `;

      // Idempotent: re-running with an existing (user, vendor) pair won't dupe.
      await tx.vendorMember.upsert({
        where: { userId_vendorId: { userId: owner.id, vendorId: vendor.id } },
        update: { role: 'owner' },
        create: { userId: owner.id, vendorId: vendor.id, role: 'owner' },
      });

      return { vendor, owner, tempPassword };
    });

    logger.info(
      {
        vendorId: result.vendor.id,
        ownerId: result.owner.id,
        createdOwner: !!result.tempPassword,
      },
      'platform admin created vendor',
    );

    res.status(201).json({
      vendor: {
        id: result.vendor.id,
        brandName: result.vendor.brandName,
        status: String(result.vendor.status),
        emirate: String(result.vendor.emirate),
        city: result.vendor.city,
        lat: result.vendor.lat,
        lng: result.vendor.lng,
      },
      owner: {
        id: result.owner.id,
        email: result.owner.email,
        fullName: result.owner.fullName,
        // Only returned when the user was newly created. The platform admin
        // is expected to deliver this to the vendor over a secure channel.
        tempPassword: result.tempPassword ?? null,
      },
    });
  }),
);

// ── Vendor detail (admin) ────────────────────────────────────────────────

platformRouter.get(
  '/vendors/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const v = await prisma.vendor.findUnique({
      where: { id: req.params.id },
      include: {
        bays: { where: { deletedAt: null }, orderBy: { name: 'asc' } },
        services: { where: { deletedAt: null }, orderBy: { priceAed: 'asc' } },
        members: {
          where: { role: 'owner' },
          include: { user: { select: { id: true, email: true, phone: true, fullName: true } } },
        },
        _count: { select: { bookings: true } },
      },
    });
    if (!v || v.deletedAt) {
      throw new HttpError(404, 'Vendor not found', { code: 'vendor_not_found' });
    }
    res.json({
      id: v.id,
      brandName: v.brandName,
      status: String(v.status),
      city: v.city,
      emirate: String(v.emirate),
      addressLine: v.addressLine,
      tradeLicenseNo: v.tradeLicenseNo,
      lat: v.lat,
      lng: v.lng,
      logoUrl: v.logoUrl,
      hours: v.hours,
      ratingAvg: v.ratingAvg,
      priceFromAed: v.priceFromAed,
      bookingCount: v._count.bookings,
      bays: v.bays.map((b) => ({
        id: b.id,
        name: b.name,
        bayType: String(b.bayType),
        status: String(b.status),
      })),
      services: v.services.map((s) => ({
        id: s.id,
        name: s.name,
        durationMin: s.durationMin,
        priceAed: s.priceAed,
        vatInclusive: s.vatInclusive,
      })),
      owner: v.members[0]
        ? {
            id: v.members[0].user.id,
            email: v.members[0].user.email,
            phone: v.members[0].user.phone,
            fullName: v.members[0].user.fullName,
          }
        : null,
      createdAt: v.createdAt.toISOString(),
    });
  }),
);

// ── Edit any vendor (admin override of the owner-side endpoint) ─────────
//
// This mirrors PATCH /admin/me/vendor but is keyed by :id and gated by
// requireRole('admin'). Hours go through the same shape; lat/lng updates
// re-write the PostGIS geom inside the same transaction.

const HHMM = z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:mm');
const dayHoursSchema = z.object({ open: HHMM, close: HHMM }).nullable();
const hoursSchema = z
  .object({
    mon: dayHoursSchema.optional(),
    tue: dayHoursSchema.optional(),
    wed: dayHoursSchema.optional(),
    thu: dayHoursSchema.optional(),
    fri: dayHoursSchema.optional(),
    sat: dayHoursSchema.optional(),
    sun: dayHoursSchema.optional(),
  })
  .strict();

const editVendorBody = z.object({
  brandName: z.string().min(1).max(120).optional(),
  city: z.string().min(1).max(80).optional(),
  emirate: z
    .enum(['AbuDhabi', 'Dubai', 'Sharjah', 'Ajman', 'UmmAlQuwain', 'RasAlKhaimah', 'Fujairah'])
    .optional(),
  addressLine: z.string().max(200).nullable().optional(),
  tradeLicenseNo: z.string().max(80).nullable().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  logoUrl: z.string().url().nullable().optional(),
  hours: hoursSchema.nullable().optional(),
});

platformRouter.patch(
  '/vendors/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = editVendorBody.parse(req.body);
    const id = req.params.id;
    const exists = await prisma.vendor.findUnique({ where: { id } });
    if (!exists || exists.deletedAt) {
      throw new HttpError(404, 'Vendor not found', { code: 'vendor_not_found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const v = await tx.vendor.update({
        where: { id },
        data: {
          ...body,
          hours:
            body.hours === undefined
              ? undefined
              : body.hours === null
                ? Prisma.JsonNull
                : (body.hours as Prisma.InputJsonValue),
        },
      });
      if (body.lat !== undefined || body.lng !== undefined) {
        await tx.$executeRaw`
          UPDATE vendors
             SET geom = ST_SetSRID(ST_MakePoint(${v.lng}, ${v.lat}), 4326)
           WHERE id = ${id}
        `;
      }
      return v;
    });

    logger.info({ vendorId: id, by: req.user!.id }, 'platform admin edited vendor');
    res.json({
      id: updated.id,
      brandName: updated.brandName,
      status: String(updated.status),
      city: updated.city,
      emirate: String(updated.emirate),
      addressLine: updated.addressLine,
      tradeLicenseNo: updated.tradeLicenseNo,
      lat: updated.lat,
      lng: updated.lng,
      logoUrl: updated.logoUrl,
      hours: updated.hours,
    });
  }),
);

// ── Status flip ─────────────────────────────────────────────────────────

const statusBody = z.object({ status: z.enum(['pending', 'active', 'suspended']) });

platformRouter.patch(
  '/vendors/:id/status',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { status } = statusBody.parse(req.body);
    const vendor = await prisma.vendor.findUnique({ where: { id: req.params.id } });
    if (!vendor || vendor.deletedAt) {
      throw new HttpError(404, 'Vendor not found', { code: 'vendor_not_found' });
    }
    const updated = await prisma.vendor.update({
      where: { id: vendor.id },
      data: { status },
    });
    logger.info(
      { vendorId: vendor.id, from: String(vendor.status), to: String(updated.status) },
      'platform admin flipped vendor status',
    );
    res.json({ id: updated.id, status: String(updated.status) });
  }),
);

// ── App users (super-admin oversight) ───────────────────────────────────
//
// Lists customers (role = 'customer') so the platform admin can see who's
// signed up, contact details, car profile, and a count of their bookings.
// A matching detail endpoint returns the full profile + booking history for
// a single user. Vendor staff and other non-admin roles cannot reach these
// (requireRole('admin')).

const listUsersQuery = z.object({
  q: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

platformRouter.get(
  '/users',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { q, limit, offset } = listUsersQuery.parse(req.query);

    const where: Prisma.UserWhereInput = { role: 'customer' };
    if (q) {
      // Substring match across the most useful identifiers. Plate is matched
      // case-insensitive after the same normalisation we apply on save.
      const plateNorm = q.trim().toUpperCase().replace(/\s+/g, ' ');
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email:    { contains: q, mode: 'insensitive' } },
        { phone:    { contains: q } },
        { carPlate: { contains: plateNorm, mode: 'insensitive' } },
        { carMake:  { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          carMake: true,
          carType: true,
          carColor: true,
          carPlate: true,
          createdAt: true,
          _count: { select: { bookings: true } },
        },
      }),
    ]);

    res.json({
      total,
      limit,
      offset,
      items: items.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        carMake: u.carMake,
        carType: u.carType ? String(u.carType) : null,
        carColor: u.carColor,
        carPlate: u.carPlate,
        bookingCount: u._count.bookings,
        profileComplete: Boolean(u.phone && u.carType && u.carPlate),
        createdAt: u.createdAt.toISOString(),
      })),
    });
  }),
);

platformRouter.get(
  '/users/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        bookings: {
          orderBy: { slotStart: 'desc' },
          take: 50,
          include: {
            vendor: { select: { id: true, brandName: true, city: true } },
            service: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!u || u.role !== 'customer') {
      throw new HttpError(404, 'User not found', { code: 'user_not_found' });
    }

    res.json({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      carMake: u.carMake,
      carType: u.carType ? String(u.carType) : null,
      carColor: u.carColor,
      carPlate: u.carPlate,
      lastLat: u.lastLat,
      lastLng: u.lastLng,
      lastLocationAt: u.lastLocationAt?.toISOString() ?? null,
      profileComplete: Boolean(u.phone && u.carType && u.carPlate),
      createdAt: u.createdAt.toISOString(),
      bookings: u.bookings.map((b) => ({
        id: b.id,
        status: String(b.status),
        slotStart: b.slotStart.toISOString(),
        slotEnd: b.slotEnd.toISOString(),
        totalAed: b.totalAed,
        vatAed: b.vatAed,
        invoiceNumber: b.invoiceNumber,
        vendor: { id: b.vendor.id, brandName: b.vendor.brandName, city: b.vendor.city },
        service: { id: b.service.id, name: b.service.name },
        createdAt: b.createdAt.toISOString(),
      })),
    });
  }),
);

// ---------- helpers ----------

/** 12-character alphanumeric password — comfortable to read aloud once. */
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[bytes[i] % chars.length];
  return out;
}
