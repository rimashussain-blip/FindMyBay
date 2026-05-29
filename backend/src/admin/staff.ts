// Vendor admin → Staff management.
//
// All routes are gated to the vendor's owner role except GET (any active
// staff member can see the list). The invite flow is intentionally minimal
// for V1: backend generates a single-use token and returns the accept URL,
// the owner copies + shares it manually (email service comes in Batch D).
//
// Endpoints:
//   GET    /admin/staff                       — list members + pending invites
//   POST   /admin/staff/invite                — create an invite, return URL
//   POST   /admin/staff/invites/:id/resend    — bump expiresAt, return URL
//   DELETE /admin/staff/invites/:id           — revoke a pending invite
//   PATCH  /admin/staff/:userId/role          — change a member's role
//   POST   /admin/staff/:userId/suspend       — flip status to 'suspended'
//   POST   /admin/staff/:userId/reactivate    — flip status to 'active'
//   DELETE /admin/staff/:userId               — remove member from vendor
//
// Public (auth-gated by the user only):
//   GET  /staff/invites/:token/preview        — lets the invitee see what they're accepting
//   POST /staff/invites/:token/accept         — accept invite (creates VendorMember)

import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { asyncHandler, HttpError } from '../lib/error.js';
import { prisma } from '../config/db.js';
import { requireAuth } from '../auth/middleware.js';
import { requireVendor } from './middleware.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { sendEmail } from '../lib/email.js';

export const staffRouter = Router();
export const staffPublicRouter = Router();

const ROLES = ['owner', 'manager', 'attendant'] as const;
const inviteBody = z.object({
  email: z.string().email().max(120),
  role: z.enum(ROLES),
});
const roleBody = z.object({ role: z.enum(ROLES) });

const INVITE_TTL_MS = 14 * 24 * 3600 * 1000; // 14 days

function makeInviteToken(): string {
  // 32 bytes ≈ 256 bits, URL-safe base64.
  return crypto.randomBytes(32).toString('base64url');
}

function buildAcceptUrl(token: string): string {
  // VENDOR_ADMIN_URL is the SPA's public URL. If unset, fall back to a
  // path-only URL so the owner can paste it under whichever host they're on.
  const base = env.VENDOR_ADMIN_URL?.replace(/\/+$/, '') ?? '';
  return `${base}/accept-invite/${token}`;
}

/**
 * Welcome email for the temp-password add-staff flow. For brand-new accounts
 * it includes the temporary password + a note that they'll set their own on
 * first sign-in; for existing accounts it just tells them they've been added.
 */
async function sendStaffWelcomeEmail(
  to: string,
  role: string,
  brandName: string,
  tempPassword: string | null,
): Promise<void> {
  const loginUrl = env.VENDOR_ADMIN_URL?.replace(/\/+$/, '') ?? 'https://admin.findmybay.me';
  const credsText = tempPassword
    ? `\nEmail: ${to}\nTemporary password: ${tempPassword}\n\nYou'll be asked to set your own password the first time you sign in.\n`
    : `\nSign in with your existing Find My Bay account (${to}).\n`;
  const credsHtml = tempPassword
    ? `<p style="margin:14px 0;padding:12px 14px;background:#E6F7F4;border-radius:10px">` +
      `Email: <b>${to}</b><br/>Temporary password: <b>${tempPassword}</b></p>` +
      `<p style="color:#5C7A75;font-size:13px">You'll set your own password the first time you sign in.</p>`
    : `<p style="color:#5C7A75">Sign in with your existing Find My Bay account (<b>${to}</b>).</p>`;
  await sendEmail({
    to,
    subject: `You've been added to ${brandName} on Find My Bay`,
    tag: 'staff-welcome',
    text: `You've been added to ${brandName} as ${role} on Find My Bay.\n\nSign in: ${loginUrl}${credsText}`,
    html:
      `<div style="font-family:system-ui,-apple-system,sans-serif;color:#0B3B36">` +
      `<h2 style="color:#0F766E">You've been added to ${brandName}</h2>` +
      `<p>Your role: <b>${role}</b>.</p>` +
      `<p><a href="${loginUrl}" style="display:inline-block;background:#0F766E;color:#fff;` +
      `padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Sign in</a></p>` +
      credsHtml +
      `</div>`,
  });
}

/**
 * Email the invitee their accept link. Best-effort: callers fire-and-forget so
 * a mail hiccup never blocks the invite (the owner can still copy the URL).
 */
async function sendStaffInviteEmail(
  to: string,
  role: string,
  brandName: string,
  acceptUrl: string,
): Promise<void> {
  await sendEmail({
    to,
    subject: `You're invited to join ${brandName} on Find My Bay`,
    tag: 'staff-invite',
    text:
      `You've been invited to join ${brandName} as ${role} on Find My Bay.\n\n` +
      `Accept your invite:\n${acceptUrl}\n\n` +
      `Sign in (or create an account) with this email address — ${to} — to accept. ` +
      `The link expires in 14 days.`,
    html:
      `<div style="font-family:system-ui,-apple-system,sans-serif;color:#0B3B36">` +
      `<h2 style="color:#0F766E">You're invited to join ${brandName}</h2>` +
      `<p>You've been added as <b>${role}</b> on Find My Bay.</p>` +
      `<p><a href="${acceptUrl}" style="display:inline-block;background:#0F766E;color:#fff;` +
      `padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Accept invite</a></p>` +
      `<p style="color:#5C7A75;font-size:13px">Sign in (or create an account) with <b>${to}</b> to accept. ` +
      `This link expires in 14 days.</p>` +
      `<p style="color:#5C7A75;font-size:12px">If the button doesn't work, paste this link:<br>${acceptUrl}</p></div>`,
  });
}

// ── GET /admin/staff ─────────────────────────────────────────────────────
staffRouter.get(
  '/staff',
  requireAuth,
  requireVendor(),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const [members, invites] = await Promise.all([
      prisma.vendorMember.findMany({
        where: { vendorId },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              lastLocationAt: true,
            },
          },
        },
      }),
      prisma.staffInvite.findMany({
        where: { vendorId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.fullName ?? m.user.email ?? '(no name)',
        email: m.user.email,
        phone: m.user.phone,
        role: String(m.role),
        status: String(m.status),
        joinedAt: m.createdAt.toISOString(),
        lastSeenAt: m.user.lastLocationAt?.toISOString() ?? null,
      })),
      invites: invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: String(i.role),
        status: String(i.status),
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
        acceptUrl: buildAcceptUrl(i.token),
      })),
    });
  }),
);

// ── POST /admin/staff/invite ─────────────────────────────────────────────
staffRouter.post(
  '/staff/invite',
  requireAuth,
  requireVendor('owner'),
  asyncHandler(async (req, res) => {
    const body = inviteBody.parse(req.body);
    const vendorId = req.vendor!.id;
    const email = body.email.trim().toLowerCase();
    const role = body.role;

    // Direct add: create the account with a temp password (or reuse an
    // existing one), attach the membership, and email credentials. No more
    // accept-link / self-registration step.
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const alreadyMember = await prisma.vendorMember.findFirst({
        where: { userId: existingUser.id, vendorId },
      });
      if (alreadyMember) {
        throw new HttpError(409, 'That email is already a member of this vendor', {
          code: 'already_member',
        });
      }
    }

    const globalRole =
      role === 'owner' ? 'vendor_owner' : role === 'manager' ? 'vendor_manager' : 'attendant';

    let userId: string;
    let tempPassword: string | null = null;
    if (existingUser) {
      // Keep their existing login + password; just grant membership.
      userId = existingUser.id;
    } else {
      tempPassword = 'Fmb' + crypto.randomBytes(5).toString('hex') + '!';
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const created = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: globalRole,
          mustChangePassword: true,
          emailVerifiedAt: new Date(), // owner vouches for the address
        },
      });
      userId = created.id;
    }

    await prisma.vendorMember.create({
      data: { userId, vendorId, role, status: 'active' },
    });

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { brandName: true },
    });
    void sendStaffWelcomeEmail(email, role, vendor?.brandName ?? 'the team', tempPassword).catch(
      (err) => logger.error({ err, email }, 'failed to send staff welcome email'),
    );

    logger.info({ vendorId, email, role, created: !existingUser }, 'staff added directly');

    res.status(201).json({ email, role, created: !existingUser });
  }),
);

// ── POST /admin/staff/invites/:id/resend ─────────────────────────────────
staffRouter.post(
  '/staff/invites/:id/resend',
  requireAuth,
  requireVendor('owner'),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const invite = await prisma.staffInvite.findFirst({
      where: { id: req.params.id, vendorId, status: 'pending' },
    });
    if (!invite) throw new HttpError(404, 'Invite not found', { code: 'not_found' });

    const updated = await prisma.staffInvite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
    });

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { brandName: true },
    });
    void sendStaffInviteEmail(
      updated.email,
      String(updated.role),
      vendor?.brandName ?? 'the team',
      buildAcceptUrl(updated.token),
    ).catch((err) => logger.error({ err, inviteId: updated.id }, 'failed to resend staff invite email'));

    res.json({
      id: updated.id,
      expiresAt: updated.expiresAt.toISOString(),
      acceptUrl: buildAcceptUrl(updated.token),
    });
  }),
);

// ── DELETE /admin/staff/invites/:id ──────────────────────────────────────
staffRouter.delete(
  '/staff/invites/:id',
  requireAuth,
  requireVendor('owner'),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    const invite = await prisma.staffInvite.findFirst({
      where: { id: req.params.id, vendorId, status: 'pending' },
    });
    if (!invite) throw new HttpError(404, 'Invite not found', { code: 'not_found' });

    await prisma.staffInvite.update({
      where: { id: invite.id },
      data: { status: 'revoked' },
    });
    res.json({ ok: true });
  }),
);

// ── PATCH /admin/staff/:userId/role ──────────────────────────────────────
staffRouter.patch(
  '/staff/:userId/role',
  requireAuth,
  requireVendor('owner'),
  asyncHandler(async (req, res) => {
    const { role } = roleBody.parse(req.body);
    const vendorId = req.vendor!.id;
    const member = await prisma.vendorMember.findFirst({
      where: { userId: req.params.userId, vendorId },
    });
    if (!member) throw new HttpError(404, 'Member not found', { code: 'not_found' });

    // Refuse to demote the last remaining owner — otherwise nobody could
    // manage staff/finance anymore.
    if (member.role === 'owner' && role !== 'owner') {
      const ownerCount = await prisma.vendorMember.count({
        where: { vendorId, role: 'owner', status: 'active' },
      });
      if (ownerCount <= 1) {
        throw new HttpError(409, "Can't demote the last owner. Promote someone else first.", {
          code: 'last_owner',
        });
      }
    }

    const updated = await prisma.vendorMember.update({
      where: { id: member.id },
      data: { role },
    });
    res.json({ userId: updated.userId, role: String(updated.role) });
  }),
);

// ── Status flip routes (suspend / reactivate) ────────────────────────────
for (const [path, status] of [
  ['suspend', 'suspended'],
  ['reactivate', 'active'],
] as const) {
  staffRouter.post(
    `/staff/:userId/${path}`,
    requireAuth,
    requireVendor('owner'),
    asyncHandler(async (req, res) => {
      const vendorId = req.vendor!.id;
      const member = await prisma.vendorMember.findFirst({
        where: { userId: req.params.userId, vendorId },
      });
      if (!member) throw new HttpError(404, 'Member not found', { code: 'not_found' });

      // Don't let an owner suspend themselves into a dead-end.
      if (req.params.userId === req.user!.id) {
        throw new HttpError(409, "You can't change your own status", {
          code: 'cannot_change_self',
        });
      }

      // Last active owner — refuse to suspend.
      if (status === 'suspended' && member.role === 'owner') {
        const activeOwnerCount = await prisma.vendorMember.count({
          where: { vendorId, role: 'owner', status: 'active' },
        });
        if (activeOwnerCount <= 1) {
          throw new HttpError(409, "Can't suspend the last active owner.", {
            code: 'last_owner',
          });
        }
      }

      const updated = await prisma.vendorMember.update({
        where: { id: member.id },
        data: { status },
      });
      res.json({ userId: updated.userId, status: String(updated.status) });
    }),
  );
}

// ── DELETE /admin/staff/:userId ──────────────────────────────────────────
staffRouter.delete(
  '/staff/:userId',
  requireAuth,
  requireVendor('owner'),
  asyncHandler(async (req, res) => {
    const vendorId = req.vendor!.id;
    if (req.params.userId === req.user!.id) {
      throw new HttpError(409, "You can't remove yourself", { code: 'cannot_change_self' });
    }
    const member = await prisma.vendorMember.findFirst({
      where: { userId: req.params.userId, vendorId },
    });
    if (!member) throw new HttpError(404, 'Member not found', { code: 'not_found' });
    if (member.role === 'owner') {
      const ownerCount = await prisma.vendorMember.count({
        where: { vendorId, role: 'owner' },
      });
      if (ownerCount <= 1) {
        throw new HttpError(409, "Can't remove the last owner.", { code: 'last_owner' });
      }
    }
    await prisma.vendorMember.delete({ where: { id: member.id } });
    res.json({ ok: true });
  }),
);

// ── Public accept routes ─────────────────────────────────────────────────
// Used by the SPA's /accept-invite/:token page.

staffPublicRouter.get(
  '/invites/:token/preview',
  asyncHandler(async (req, res) => {
    const invite = await prisma.staffInvite.findUnique({
      where: { token: req.params.token },
      include: { vendor: { select: { brandName: true, city: true, emirate: true } } },
    });
    if (!invite) throw new HttpError(404, 'Invite not found', { code: 'not_found' });
    if (invite.expiresAt.getTime() < Date.now() && invite.status === 'pending') {
      // Lazy-expire on first read.
      await prisma.staffInvite.update({
        where: { id: invite.id },
        data: { status: 'expired' },
      });
      invite.status = 'expired';
    }
    res.json({
      email: invite.email,
      role: String(invite.role),
      status: String(invite.status),
      expiresAt: invite.expiresAt.toISOString(),
      vendor: {
        brandName: invite.vendor.brandName,
        city: invite.vendor.city,
        emirate: String(invite.vendor.emirate),
      },
    });
  }),
);

staffPublicRouter.post(
  '/invites/:token/accept',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Auth required');
    const invite = await prisma.staffInvite.findUnique({
      where: { token: req.params.token },
    });
    if (!invite) throw new HttpError(404, 'Invite not found', { code: 'not_found' });
    if (invite.status !== 'pending') {
      throw new HttpError(409, `Invite is ${invite.status}`, {
        code: `invite_${invite.status}`,
      });
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      await prisma.staffInvite.update({
        where: { id: invite.id },
        data: { status: 'expired' },
      });
      throw new HttpError(409, 'Invite has expired', { code: 'invite_expired' });
    }
    // An invite is addressed to a specific email. Require the signed-in user to
    // actually be that person. Without this, an owner who opens their OWN
    // invite link (e.g. to test it) overwrites their existing membership and
    // demotes themselves to the invited role — leaving the vendor with no
    // owner. Match on email so accepting can only ever add the intended person.
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw new HttpError(404, 'User not found');
    if ((user.email ?? '').toLowerCase() !== invite.email.toLowerCase()) {
      throw new HttpError(
        403,
        `This invite was sent to ${invite.email}. Sign in with that account to accept it.`,
        { code: 'invite_email_mismatch' },
      );
    }

    // Already a member? Just bump the role to whatever the invite said.
    const existing = await prisma.vendorMember.findFirst({
      where: { userId: req.user.id, vendorId: invite.vendorId },
    });

    // Belt-and-braces: never let accepting an invite demote the last owner.
    if (existing && existing.role === 'owner' && invite.role !== 'owner') {
      const ownerCount = await prisma.vendorMember.count({
        where: { vendorId: invite.vendorId, role: 'owner', status: 'active' },
      });
      if (ownerCount <= 1) {
        throw new HttpError(409, "Can't accept an invite that would demote the last owner.", {
          code: 'last_owner',
        });
      }
    }

    const memberPromise = existing
      ? prisma.vendorMember.update({
          where: { id: existing.id },
          data: { role: invite.role, status: 'active' },
        })
      : prisma.vendorMember.create({
          data: {
            userId: req.user.id,
            vendorId: invite.vendorId,
            role: invite.role,
            status: 'active',
          },
        });

    const [member] = await prisma.$transaction([
      memberPromise,
      prisma.staffInvite.update({
        where: { id: invite.id },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
          acceptedById: req.user.id,
        },
      }),
    ]);

    res.json({
      ok: true,
      vendorId: member.vendorId,
      role: String(member.role),
    });
  }),
);
