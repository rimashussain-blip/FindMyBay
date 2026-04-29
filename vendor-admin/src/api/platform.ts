// Platform-admin API client — backs the /platform/* pages. All endpoints
// hit /admin/platform/* on the backend, gated by requireRole('admin').

import { api } from './client';
import type {
  AdminBay,
  AdminService,
  Emirate,
  VendorStatus,
  WeeklyHours,
} from './admin';

export interface PlatformVendor {
  id: string;
  brandName: string;
  status: VendorStatus;
  emirate: Emirate;
  city: string;
  addressLine: string | null;
  tradeLicenseNo: string | null;
  ratingAvg: number | null;
  owner: {
    id: string;
    email: string | null;
    phone: string | null;
    fullName: string | null;
  } | null;
  counts: {
    bays: number;
    services: number;
    bookings: number;
  };
  createdAt: string;
}

export const listPlatformVendors = async (): Promise<{ items: PlatformVendor[] }> => {
  const { data } = await api.get('/admin/platform/vendors');
  return data;
};

export interface CreateVendorBody {
  brandName: string;
  city: string;
  emirate: Emirate;
  lat: number;
  lng: number;
  addressLine?: string;
  tradeLicenseNo?: string;
  ownerEmail?: string;
  ownerFullName?: string;
  ownerUserId?: string;
}

export interface CreateVendorResponse {
  vendor: {
    id: string;
    brandName: string;
    status: VendorStatus;
    emirate: Emirate;
    city: string;
    lat: number;
    lng: number;
  };
  owner: {
    id: string;
    email: string | null;
    fullName: string | null;
    /** Only populated when a brand-new user was created. */
    tempPassword: string | null;
  };
}

export const createPlatformVendor = async (body: CreateVendorBody): Promise<CreateVendorResponse> => {
  const { data } = await api.post('/admin/platform/vendors', body);
  return data;
};

export const setVendorStatus = async (
  id: string,
  status: VendorStatus,
): Promise<{ id: string; status: VendorStatus }> => {
  const { data } = await api.patch(`/admin/platform/vendors/${id}/status`, { status });
  return data;
};

// ── Vendor detail + admin-side edit ─────────────────────────────────────

export interface PlatformVendorDetail {
  id: string;
  brandName: string;
  status: VendorStatus;
  city: string;
  emirate: Emirate;
  addressLine: string | null;
  tradeLicenseNo: string | null;
  lat: number;
  lng: number;
  logoUrl: string | null;
  hours: WeeklyHours | null;
  ratingAvg: number | null;
  priceFromAed: number | null;
  bookingCount: number;
  bays: AdminBay[];
  services: AdminService[];
  owner: {
    id: string;
    email: string | null;
    phone: string | null;
    fullName: string | null;
  } | null;
  createdAt: string;
}

export const getPlatformVendor = async (id: string): Promise<PlatformVendorDetail> => {
  const { data } = await api.get(`/admin/platform/vendors/${id}`);
  return data;
};

export interface UpdatePlatformVendorBody {
  brandName?: string;
  city?: string;
  emirate?: Emirate;
  addressLine?: string | null;
  tradeLicenseNo?: string | null;
  lat?: number;
  lng?: number;
  logoUrl?: string | null;
  hours?: WeeklyHours | null;
}

export const updatePlatformVendor = async (
  id: string,
  body: UpdatePlatformVendorBody,
): Promise<PlatformVendorDetail> => {
  const { data } = await api.patch(`/admin/platform/vendors/${id}`, body);
  return data as PlatformVendorDetail;
};
