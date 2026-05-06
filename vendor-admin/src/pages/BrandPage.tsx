// Brand & Branch — vendor owner edits the public-facing storefront info.
//
// Manager/attendant accounts get the form rendered read-only. Backend will
// reject the PATCH with 403 for them too; we mirror that on the client so
// it doesn't look like a bug.

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMe,
  updateBrand,
  type AdminVendor,
  type DayHours,
  type DayOfWeek,
  type Emirate,
  type WeeklyHours,
} from '../api/admin';
import LogoUpload from '../components/LogoUpload';

const EMIRATES: { value: Emirate; label: string }[] = [
  { value: 'AbuDhabi', label: 'Abu Dhabi' },
  { value: 'Dubai', label: 'Dubai' },
  { value: 'Sharjah', label: 'Sharjah' },
  { value: 'Ajman', label: 'Ajman' },
  { value: 'UmmAlQuwain', label: 'Umm Al Quwain' },
  { value: 'RasAlKhaimah', label: 'Ras Al Khaimah' },
  { value: 'Fujairah', label: 'Fujairah' },
];

const DAY_LABELS: { key: DayOfWeek; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

const DEFAULT_HOURS: WeeklyHours = {
  mon: { open: '08:00', close: '22:00' },
  tue: { open: '08:00', close: '22:00' },
  wed: { open: '08:00', close: '22:00' },
  thu: { open: '08:00', close: '22:00' },
  fri: { open: '08:00', close: '22:00' },
  sat: { open: '09:00', close: '21:00' },
  sun: { open: '09:00', close: '21:00' },
};

interface FormState {
  brandName: string;
  tradeLicenseNo: string;
  emirate: Emirate;
  city: string;
  addressLine: string;
  lat: string; // string while editing; parsed on save
  lng: string;
  logoUrl: string;
  hours: WeeklyHours;
}

function vendorToForm(v: AdminVendor): FormState {
  return {
    brandName: v.brandName,
    tradeLicenseNo: v.tradeLicenseNo ?? '',
    emirate: v.emirate,
    city: v.city,
    addressLine: v.addressLine ?? '',
    lat: String(v.lat),
    lng: String(v.lng),
    logoUrl: v.logoUrl ?? '',
    hours: v.hours ?? DEFAULT_HOURS,
  };
}

export default function BrandPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: getMe });
  const role = data?.role;
  const canEdit = role === 'owner';

  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Hydrate form once we have the vendor.
  useEffect(() => {
    if (data?.vendor && form === null) setForm(vendorToForm(data.vendor));
  }, [data, form]);

  const save = useMutation({
    mutationFn: updateBrand,
    onSuccess: () => {
      setSavedAt(Date.now());
      setError(null);
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: unknown) => setError(extractError(e)),
  });

  const dirty = useMemo(() => {
    if (!data?.vendor || !form) return false;
    return JSON.stringify(form) !== JSON.stringify(vendorToForm(data.vendor));
  }, [data, form]);

  if (isLoading || !form || !data) return <div className="text-ink-soft">Loading…</div>;

  function handleSave() {
    if (!form) return;
    setError(null);
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setError('Latitude must be a number between -90 and 90.');
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setError('Longitude must be a number between -180 and 180.');
      return;
    }
    if (!form.brandName.trim()) {
      setError('Brand name is required.');
      return;
    }
    save.mutate({
      brandName: form.brandName.trim(),
      tradeLicenseNo: form.tradeLicenseNo.trim() || null,
      emirate: form.emirate,
      city: form.city.trim(),
      addressLine: form.addressLine.trim() || null,
      lat,
      lng,
      logoUrl: form.logoUrl.trim() || null,
      hours: form.hours,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="label-eyebrow mb-1">Storefront</div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Brand &amp; branch</h1>
          <p className="mt-1 text-sm text-ink-soft">
            What customers see on your detail page. Updates are live the moment you save.
          </p>
        </div>
        {canEdit && (
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!dirty || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </header>

      {data.vendor.status !== 'active' && (
        <StatusBanner status={data.vendor.status} />
      )}

      {!canEdit && (
        <div className="card border-coral-soft bg-coral-soft/30 text-sm text-ink-soft">
          You're signed in as <strong>{role}</strong>. Only the vendor owner can edit brand info.
          Anything you change here won't save.
        </div>
      )}

      {error && (
        <div className="card border-coral bg-coral-soft text-sm text-coral">{error}</div>
      )}

      {savedAt && !dirty && !error && (
        <div className="card border-mint-edge bg-mint text-sm text-primary-deep">
          Saved. Customers see the new info on their next refresh.
        </div>
      )}

      {/* Identity */}
      <Section title="Identity">
        <Field label="Brand name">
          <input
            className="input"
            value={form.brandName}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => f && { ...f, brandName: e.target.value })}
          />
        </Field>
        <Field label="Trade license number">
          <input
            className="input"
            value={form.tradeLicenseNo}
            disabled={!canEdit}
            placeholder="e.g. CN-1234567"
            onChange={(e) => setForm((f) => f && { ...f, tradeLicenseNo: e.target.value })}
          />
        </Field>
        <Field label="Logo">
          <LogoUpload
            value={form.logoUrl}
            disabled={!canEdit}
            onChange={(next) => setForm((f) => f && { ...f, logoUrl: next })}
          />
        </Field>
      </Section>

      {/* Location */}
      <Section title="Location">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Emirate">
            <select
              className="input"
              value={form.emirate}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => f && { ...f, emirate: e.target.value as Emirate })}
            >
              {EMIRATES.map((em) => (
                <option key={em.value} value={em.value}>
                  {em.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="City / Area">
            <input
              className="input"
              value={form.city}
              disabled={!canEdit}
              placeholder="Business Bay"
              onChange={(e) => setForm((f) => f && { ...f, city: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Street address" hint="Used on the booking confirmation receipt.">
          <input
            className="input"
            value={form.addressLine}
            disabled={!canEdit}
            placeholder="Building 12, Sheikh Zayed Rd"
            onChange={(e) => setForm((f) => f && { ...f, addressLine: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Latitude"
            hint={
              <>
                Right-click your location in{' '}
                <a
                  href="https://www.google.com/maps"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary-deep hover:underline"
                >
                  Google Maps
                </a>{' '}
                to copy lat/lng.
              </>
            }
          >
            <input
              className="input"
              type="text"
              inputMode="decimal"
              value={form.lat}
              disabled={!canEdit}
              placeholder="25.1972"
              onChange={(e) => setForm((f) => f && { ...f, lat: e.target.value })}
            />
          </Field>
          <Field label="Longitude">
            <input
              className="input"
              type="text"
              inputMode="decimal"
              value={form.lng}
              disabled={!canEdit}
              placeholder="55.2744"
              onChange={(e) => setForm((f) => f && { ...f, lng: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      {/* Hours */}
      <Section
        title="Operating hours"
        hint="Customers can only book during these windows. Toggle a day off to mark it closed."
      >
        <HoursEditor
          hours={form.hours}
          onChange={(hours) => setForm((f) => f && { ...f, hours })}
          disabled={!canEdit}
        />
      </Section>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-eyebrow">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-ink-soft">{hint}</span>}
    </label>
  );
}

function StatusBanner({ status }: { status: AdminVendor['status'] }) {
  if (status === 'pending') {
    return (
      <div
        className="card border-amber/50 text-sm text-ink"
        style={{ background: 'linear-gradient(135deg, #FCE7C8 0%, #FFE3D9 100%)' }}
      >
        <strong className="font-bold">Awaiting platform approval.</strong> Your storefront is
        hidden from customers until a Find My Bay admin activates it. You can keep editing in the
        meantime — changes are saved.
      </div>
    );
  }
  if (status === 'suspended') {
    return (
      <div className="card border-coral bg-coral-soft text-sm text-coral">
        <strong className="font-bold">Suspended.</strong> Customers can't see or book you.
        Contact support for reinstatement.
      </div>
    );
  }
  return null;
}

function HoursEditor({
  hours,
  onChange,
  disabled,
}: {
  hours: WeeklyHours;
  onChange: (h: WeeklyHours) => void;
  disabled: boolean;
}) {
  function setDay(day: DayOfWeek, value: DayHours) {
    onChange({ ...hours, [day]: value });
  }

  return (
    <div className="flex flex-col gap-2">
      {DAY_LABELS.map(({ key, label }) => {
        const dayHours = hours[key] ?? null;
        const isOpen = dayHours !== null;
        return (
          <div
            key={key}
            className="flex items-center gap-3 rounded-xl border border-mint-edge bg-white px-3 py-2"
          >
            <div className="w-10 text-sm font-bold text-ink">{label}</div>
            <label className="inline-flex items-center gap-2 text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={isOpen}
                disabled={disabled}
                onChange={(e) =>
                  setDay(key, e.target.checked ? { open: '08:00', close: '22:00' } : null)
                }
              />
              Open
            </label>
            <div className="ml-auto flex items-center gap-2">
              <input
                type="time"
                className="input w-28"
                value={dayHours?.open ?? '08:00'}
                disabled={disabled || !isOpen}
                onChange={(e) =>
                  setDay(key, { open: e.target.value, close: dayHours?.close ?? '22:00' })
                }
              />
              <span className="text-ink-soft">→</span>
              <input
                type="time"
                className="input w-28"
                value={dayHours?.close ?? '22:00'}
                disabled={disabled || !isOpen}
                onChange={(e) =>
                  setDay(key, { open: dayHours?.open ?? '08:00', close: e.target.value })
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } }).response;
    return resp?.data?.error?.message ?? 'Couldn’t save changes';
  }
  return e instanceof Error ? e.message : 'Couldn’t save changes';
}
