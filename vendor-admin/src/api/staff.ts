// Vendor admin — Staff management API client.
//
// Mirrors backend/src/admin/staff.ts. Routes are all under /admin/staff/*
// except the invite-accept flow which is /staff/invites/:token/*.

import { api } from './client';

export type StaffRole = 'owner' | 'manager' | 'attendant';
export type StaffStatus = 'active' | 'suspended';
export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface StaffMember {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: StaffRole;
  status: StaffStatus;
  joinedAt: string;
  lastSeenAt: string | null;
}

export interface StaffInvite {
  id: string;
  email: string;
  role: StaffRole;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
  acceptUrl: string;
}

export interface StaffListResponse {
  members: StaffMember[];
  invites: StaffInvite[];
}

export async function listStaff(): Promise<StaffListResponse> {
  const { data } = await api.get<StaffListResponse>('/admin/staff');
  return data;
}

export async function inviteStaff(body: { email: string; role: StaffRole }): Promise<StaffInvite> {
  const { data } = await api.post<StaffInvite>('/admin/staff/invite', body);
  return data;
}

export async function resendInvite(id: string): Promise<{ id: string; expiresAt: string; acceptUrl: string }> {
  const { data } = await api.post(`/admin/staff/invites/${id}/resend`);
  return data;
}

export async function revokeInvite(id: string): Promise<void> {
  await api.delete(`/admin/staff/invites/${id}`);
}

export async function changeRole(userId: string, role: StaffRole): Promise<void> {
  await api.patch(`/admin/staff/${userId}/role`, { role });
}

export async function suspendStaff(userId: string): Promise<void> {
  await api.post(`/admin/staff/${userId}/suspend`);
}

export async function reactivateStaff(userId: string): Promise<void> {
  await api.post(`/admin/staff/${userId}/reactivate`);
}

export async function removeStaff(userId: string): Promise<void> {
  await api.delete(`/admin/staff/${userId}`);
}

// ── Accept-invite flow (used by the /accept-invite/:token page) ──────────

export interface InvitePreview {
  email: string;
  role: StaffRole;
  status: InviteStatus;
  expiresAt: string;
  vendor: {
    brandName: string;
    city: string;
    emirate: string;
  };
}

export async function previewInvite(token: string): Promise<InvitePreview> {
  const { data } = await api.get<InvitePreview>(`/staff/invites/${token}/preview`);
  return data;
}

export async function acceptInvite(token: string): Promise<{ ok: true; vendorId: string; role: StaffRole }> {
  const { data } = await api.post(`/staff/invites/${token}/accept`);
  return data;
}
