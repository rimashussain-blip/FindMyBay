// Vendor admin — Finance API client.
//
// Mirrors backend/src/admin/finance.ts. Used by the /finance page.

import { api } from './client';

export interface FinanceRange { from: string; to: string }

export interface FinanceOverview {
  range: FinanceRange;
  bookings: { completed: number; appPaid: number; walkInCash: number };
  revenue: { grossAed: number; refundsAed: number; netAed: number; discountAed: number };
  vat: { collectedAed: number; refundedAed: number; netDueAed: number; ratePct: number };
  payout: { netToVendorExVatAed: number };
  refunds: { count: number; totalAed: number };
}

export type PaymentStatusFilter = 'paid' | 'unpaid' | 'walkin' | 'refunded';

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  slotStart: string;
  totalAed: number;
  vatAed: number;
  discountAed: number;
  refundedAed: number;
  netAed: number;
  isWalkIn: boolean;
  paymentStatus: 'paid' | 'unpaid' | 'cash';
  serviceName: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
}

export interface InvoiceListResponse {
  page: number;
  pageSize: number;
  total: number;
  items: InvoiceRow[];
}

export interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  issuedAt: string;
  slotStart: string;
  slotEnd: string;
  isWalkIn: boolean;
  vendor: {
    brandName: string;
    trnNumber: string | null;
    addressLine: string | null;
    city: string;
    emirate: string;
    logoUrl: string | null;
  };
  customer: { name: string | null; phone: string | null; email: string | null };
  line: {
    serviceName: string;
    bayName: string;
    subtotalAed: number;
    vatAed: number;
    totalAed: number;
    discountAed: number;
    promoCode: string | null;
    promoName: string | null;
  };
  payment: {
    method: string | null;
    status: string;
    paidAt?: string | null;
    externalRef?: string | null;
  };
  refunds: Array<{
    id: string;
    creditNoteNumber: string | null;
    amountAed: number;
    vatAed: number;
    reason: string;
    status: string;
    createdAt: string;
  }>;
  summary: { refundedAed: number; netAed: number; vatRatePct: number };
}

export interface VatSummaryBucket {
  bucket: string;
  bookings: number;
  grossAed: number;
  refundedAed: number;
  netAed: number;
  vatCollectedAed: number;
  vatRefundedAed: number;
  vatDueAed: number;
}

export interface VatSummary {
  range: FinanceRange;
  bucket: 'day' | 'month';
  ratePct: number;
  items: VatSummaryBucket[];
  totals: Omit<VatSummaryBucket, 'bucket'>;
}

export interface RefundRow {
  id: string;
  creditNoteNumber: string | null;
  amountAed: number;
  vatAed: number;
  reason: string;
  status: 'processed' | 'voided';
  createdAt: string;
  booking: {
    id: string;
    invoiceNumber: string | null;
    slotStart: string;
    serviceName: string;
    customerName: string | null;
    customerPhone: string | null;
  };
}

export interface RefundListResponse {
  page: number;
  pageSize: number;
  total: number;
  items: RefundRow[];
}

function rangeParams(from?: string, to?: string) {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return params;
}

export async function getFinanceOverview(from?: string, to?: string): Promise<FinanceOverview> {
  const { data } = await api.get('/admin/finance/overview', { params: rangeParams(from, to) });
  return data;
}

export async function listInvoices(opts: {
  from?: string;
  to?: string;
  q?: string;
  status?: PaymentStatusFilter;
  page?: number;
  pageSize?: number;
}): Promise<InvoiceListResponse> {
  const { data } = await api.get('/admin/finance/invoices', { params: opts });
  return data;
}

export async function getInvoiceDetail(bookingId: string): Promise<InvoiceDetail> {
  const { data } = await api.get(`/admin/finance/invoices/${bookingId}`);
  return data;
}

export async function getVatSummary(opts: {
  from?: string;
  to?: string;
  bucket?: 'day' | 'month';
}): Promise<VatSummary> {
  const { data } = await api.get('/admin/finance/vat-summary', { params: opts });
  return data;
}

export function vatSummaryCsvUrl(opts: { from?: string; to?: string; bucket?: 'day' | 'month' }): string {
  // Build a downloadable URL the user can click. Axios baseURL is private to
  // the instance — we read VITE_API_BASE_URL the same way for the link.
  const base = import.meta.env.VITE_API_BASE_URL || '/api';
  const params = new URLSearchParams({ format: 'csv' });
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  if (opts.bucket) params.set('bucket', opts.bucket);
  return `${base}/admin/finance/vat-summary?${params.toString()}`;
}

export async function recordRefund(bookingId: string, body: { amountAed: number; reason: string }) {
  const { data } = await api.post(`/admin/bookings/${bookingId}/refund`, body);
  return data;
}

export async function listRefunds(opts: {
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<RefundListResponse> {
  const { data } = await api.get('/admin/finance/refunds', { params: opts });
  return data;
}

export async function voidRefund(refundId: string) {
  const { data } = await api.post(`/admin/finance/refunds/${refundId}/void`);
  return data;
}
