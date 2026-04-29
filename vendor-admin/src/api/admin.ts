import { api } from './client';

export type Emirate =
  | 'AbuDhabi'
  | 'Dubai'
  | 'Sharjah'
  | 'Ajman'
  | 'UmmAlQuwain'
  | 'RasAlKhaimah'
  | 'Fujairah';

export type VendorStatus = 'pending' | 'active' | 'suspended';

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type DayHours = { open: string; close: string } | null;

export type WeeklyHours = Partial<Record<DayOfWeek, DayHours>>;

export interface AdminVendor {
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
  bays: AdminBay[];
  services: AdminService[];
}

export interface AdminBay {
  id: string;
  name: string;
  bayType: string;
  status: 'free' | 'busy' | 'closed';
}

export interface AdminService {
  id: string;
  name: string;
  durationMin: number;
  priceAed: number;
  vatInclusive: boolean;
}

export interface AdminBooking {
  id: string;
  status: string;
  slotStart: string;
  slotEnd: string;
  totalAed: number;
  customer: { id: string; phone: string; fullName: string | null };
  service: { id: string; name: string; durationMin: number; priceAed: number };
  bay: { id: string; name: string };
}

export const getMe = async (): Promise<{ vendor: AdminVendor; role: string }> => {
  const { data } = await api.get('/admin/me');
  return data;
};

export const setBayStatus = async (bayId: string, status: AdminBay['status']) => {
  const { data } = await api.patch(`/admin/bays/${bayId}/status`, { status });
  return data;
};

export type BayType = 'sedan' | 'suv' | 'bike';

export interface CreateBayBody {
  name: string;
  bayType: BayType;
}

export const createBay = async (body: CreateBayBody): Promise<AdminBay> => {
  const { data } = await api.post('/admin/bays', body);
  return data as AdminBay;
};

export const createService = async (body: Omit<AdminService, 'id'>) => {
  const { data } = await api.post('/admin/services', body);
  return data;
};

export const updateService = async (id: string, body: Partial<Omit<AdminService, 'id'>>) => {
  const { data } = await api.patch(`/admin/services/${id}`, body);
  return data;
};

export const deleteService = async (id: string) => {
  await api.delete(`/admin/services/${id}`);
};

export const getTodayBookings = async (): Promise<{ items: AdminBooking[] }> => {
  const { data } = await api.get('/admin/bookings/today');
  return data;
};

export const setBookingStatus = async (id: string, status: string) => {
  const { data } = await api.patch(`/admin/bookings/${id}/status`, { status });
  return data;
};

export interface CheckinResult {
  ok: boolean;
  alreadyCheckedIn: boolean;
  booking: {
    id: string;
    status: string;
    slotStart: string;
    customer: { id: string; phone: string; fullName: string | null };
    service: { id: string; name: string; durationMin: number };
    bay: { id: string; name: string };
  };
}

export const checkinByQr = async (qr: string): Promise<CheckinResult> => {
  const { data } = await api.post('/admin/checkin', { qr });
  return data;
};

export const checkinByCode = async (code: string): Promise<CheckinResult> => {
  const { data } = await api.post('/admin/checkin/code', { code });
  return data;
};

export interface AdminReview {
  id: string;
  rating: number;
  note: string | null;
  createdAt: string;
  bookingId: string;
  slotStart: string;
  serviceName: string;
  customerName: string;
}

export interface AdminReviewsResponse {
  summary: { ratingAvg: number | null; count: number };
  items: AdminReview[];
}

export const getReviews = async (): Promise<AdminReviewsResponse> => {
  const { data } = await api.get('/admin/reviews');
  return data;
};

// ── Brand & branch ──────────────────────────────────────────────────────

export interface UpdateBrandBody {
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

export const updateBrand = async (body: UpdateBrandBody): Promise<AdminVendor> => {
  const { data } = await api.patch('/admin/me/vendor', body);
  return data as AdminVendor;
};
