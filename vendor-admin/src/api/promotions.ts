// Vendor admin — Promotions API client.
//
// Mirrors backend/src/admin/promotions.ts. The Promotion shape returned
// by the server is the same regardless of which CRUD endpoint produced
// it, so we type one Promotion DTO and reuse it.

import { api } from './client';

export type PromotionType = 'percent' | 'fixed' | 'bundle';

export type CarType =
  | 'sedan'
  | 'hatchback'
  | 'suv'
  | 'pickup'
  | 'van'
  | 'coupe'
  | 'other';
export type PromotionStatus =
  | 'active'
  | 'scheduled'
  | 'paused'
  | 'expired'
  | 'archived';

export interface Promotion {
  id: string;
  vendorId: string | null;
  name: string;
  code: string;
  type: PromotionType;
  value: number;
  applicableServiceIds: string[];
  applicableCarTypes: CarType[];
  minSpendAed: number | null;
  startsAt: string;
  endsAt: string;
  usageLimit: number;
  perCustomerLimit: number;
  autoApplied: boolean;
  featured: boolean;
  terms: string | null;
  status: PromotionStatus;
  used: number;
  amountOffAedTotal: number;
}

export interface PromotionListResponse {
  tab: 'active' | 'scheduled' | 'expired';
  counts: { active: number; scheduled: number; expired: number };
  items: Promotion[];
}

export interface CreatePromotionBody {
  name: string;
  code: string;
  type: PromotionType;
  value: number;
  applicableServiceIds?: string[];
  applicableCarTypes?: CarType[];
  minSpendAed?: number | null;
  startsAt: string;
  endsAt: string;
  usageLimit?: number;
  perCustomerLimit?: number;
  autoApplied?: boolean;
  featured?: boolean;
  terms?: string | null;
}

export type UpdatePromotionBody = Partial<CreatePromotionBody>;

export const listPromotions = async (
  tab: 'active' | 'scheduled' | 'expired',
): Promise<PromotionListResponse> => {
  const { data } = await api.get('/admin/promotions', { params: { tab } });
  return data as PromotionListResponse;
};

export const createPromotion = async (body: CreatePromotionBody): Promise<Promotion> => {
  const { data } = await api.post('/admin/promotions', body);
  return data as Promotion;
};

export const updatePromotion = async (
  id: string,
  body: UpdatePromotionBody,
): Promise<Promotion> => {
  const { data } = await api.patch(`/admin/promotions/${id}`, body);
  return data as Promotion;
};

export const pausePromotion = async (id: string): Promise<Promotion> => {
  const { data } = await api.post(`/admin/promotions/${id}/pause`);
  return data as Promotion;
};

export const resumePromotion = async (id: string): Promise<Promotion> => {
  const { data } = await api.post(`/admin/promotions/${id}/resume`);
  return data as Promotion;
};

export const archivePromotion = async (id: string): Promise<Promotion> => {
  const { data } = await api.post(`/admin/promotions/${id}/archive`);
  return data as Promotion;
};
