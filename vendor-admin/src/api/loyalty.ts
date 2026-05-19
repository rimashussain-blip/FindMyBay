// Vendor admin — Loyalty API client.
// Mirrors backend/src/admin/loyalty.ts.

import { api } from './client';

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyCounts {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
}

export interface LoyaltySnapshot {
  tier: LoyaltyTier;
  lifetimeBookings: number;
  lifetimeSpendAed: number;
  bookingsAtVendor?: number;
  lastBookingAt: string | null;
}

export interface LoyaltyRosterItem {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  car: {
    make: string | null;
    type: string | null;
    color: string | null;
    plate: string | null;
  };
  tier: LoyaltyTier;
  lifetimeBookings: number;
  lifetimeSpendAed: number;
  bookingsAtVendor: number;
  lastBookingAt: string | null;
}

export interface LoyaltyRoster {
  page: number;
  pageSize: number;
  total: number;
  items: LoyaltyRosterItem[];
  counts: LoyaltyCounts;
}

export interface LoyaltyDetail {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  memberSince: string;
  car: {
    make: string | null;
    type: string | null;
    color: string | null;
    plate: string | null;
  };
  loyalty: LoyaltySnapshot;
  nextTier: {
    current: LoyaltyTier;
    next: LoyaltyTier | null;
    bookingsToGo: number | null;
    spendToGoAed: number | null;
  };
  recentBookings: Array<{
    id: string;
    slotStart: string;
    status: string;
    totalAed: number;
    invoiceNumber: string | null;
    serviceName: string;
  }>;
}

export async function listLoyalty(opts: {
  tier?: LoyaltyTier;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<LoyaltyRoster> {
  const { data } = await api.get('/admin/loyalty/customers', { params: opts });
  return data;
}

export async function getLoyaltyDetail(userId: string): Promise<LoyaltyDetail> {
  const { data } = await api.get(`/admin/loyalty/customers/${userId}`);
  return data;
}
