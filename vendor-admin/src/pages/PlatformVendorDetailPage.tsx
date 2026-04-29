// Platform super-admin: drill into a single vendor.
// Reuses BrandPage's hours editor behavior; layout adapts for the admin
// context (read-only summary first, edit mode behind an Edit button).

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPlatformVendor,
  setVendorStatus,
  updatePlatformVendor,
  type PlatformVendorDetail,
  type UpdatePlatformVendorBody,
} from '../api/platform';
import type { DayHours, DayOfWeek, Emirate, VendorStatus, WeeklyHours } from '../api/admin';

const EMIRATES: { value: Emirate; label: string }[] = [
  { value: 'Dubai', label: 'Dubai' },
  { value: 'AbuDhabi', label: 'Abu Dhabi' },
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
  lat: string;
  lng: string;
  logoUrl: string;
  hours: WeeklyHours;
}

function vendorToForm(v: PlatformVendorDetail): FormState {
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

export default function PlatformVendorDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error: fetchError } = useQuery({
    queryKey: ['platform', 'vendor', id],
    queryFn: () => getPlatformVendor(id),
    enabled: !!id,
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hydrate the edit form whenever data lands or edit mode is entered.
  useEffect(() => {
    if (data && (form === null || editing)) {
      setForm(vendorToForm(data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, editing]);

  const save = useMutation({
    mutationFn: (body: UpdatePlatformVendorBody) => updatePlatformVendor(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'vendor', id] });
      qc.invalidateQueries({ queryKey: ['platform', 'vendors'] });
      setEditing(false);
      setError(null);
    },
    onError: (e: unknown) => setError(extractError(e)),
  });

  const flip = useMutation({
    mutationFn: (status: VendorStatus) => setVendorStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'vendor', id] });
      qc.invalidateQueries({ queryKey: ['platform', 'vendors'] });
    },
  });

  const dirty = useMemo(() => {
    if (!data || !form) return false;
    return JSON.stringify(form) !== JSON.stringify(vendorToForm(data));
  }, [data, form]);

  if (isLoading) return <div className="text-ink-soft">Loading vendor…</div>;
  if (fetchError || !data)
    return (
      <div className="card border-coral bg-coral-soft text-sm text-coral">
        Vendor not found.
        <div className="mt-2">
          <Link to="/platform/vendors" className="text-primary-deep hover:underline">
            ← Back to vendors
          </Link>
        </div>
      </div>
    );

  function onSave() {
    if (!form) return;
    setError(null);
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90)
      return setError('Latitude must be between -90 and 90.');
    if (!Number.isFinite(lng) || lng < -180 || lng > 180)
      return setError('Longitude must be between -180 and 180.');
    if (!form.brandName.trim()) return setError('Brand name is required.');
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
      {/* Header */}
      <header className="flex items-end justify-between gap-6">
        <div>
          <Link to="/platform/vendors" className="text-xs text-primary-deep hover:underline">
            ← All vendors
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">{data.brandName}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
            <StatusPill status={data.status} />
            <span>·</span>
            <span>{prettyEmirate(data.emirate)}, {data.city}</span>
            {data.ratingAvg && (
              <>
                <span>·</span>
                <span>★ {data.ratingAvg.toFixed(1)}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.status === 'pending' && (
            <button
              className="rounded-full bg-primary-deep px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-deep/90 disabled:opacity-50"
              onClick={() => flip.mutate('active')}
              disabled={flip.isPending}
            >
              Approve
            </button>
          )}
          {data.status === 'active' && (
            <button
              className="rounded-full bg-coral-soft px-3 py-1.5 text-xs font-bold text-coral hover:bg-coral-soft/80 disabled:opacity-50"
              onClick={() => flip.mutate('suspended')}
              disabled={flip.isPending}
            >
              Suspend
            </button>
          )}
          {data.status === 'suspended' && (
            <button
              className="rounded-full bg-primary-deep px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-deep/90 disabled:opacity-50"
              onClick={() => flip.mutate('active')}
              disabled={flip.isPending}
            >
              Reactivate
            </button>
          )}
          {!editing ? (
            <button className="btn-primary" onClick={() => setEditing(true)}>
              Edit brand
            </button>
          ) : (
            <>
              <button
                className="btn-text px-4 py-2"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  if (data) setForm(vendorToForm(data));
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={onSave}
                disabled={!dirty || save.isPending}
              >
                {save.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </>
          )}
        </div>
      </header>

      {error && <div className="card border-coral bg-coral-soft text-sm text-coral">{error}</div>}

      {/* Stats strip */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Bays" value={data.bays.length} />
        <Stat label="Services" value={data.services.length} />
        <Stat label="Bookings" value={data.bookingCount} />
        <Stat label="Onboarded" value={new Date(data.createdAt).toLocaleDateString()} />
      </section>

      {/* Owner */}
      <section className="card flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Owner</h2>
          {data.owner && data.owner.email && (
            <a
              className="text-xs text-primary-deep hover:underline"
              href={`mailto:${data.owner.email}`}
            >
              {data.owner.email}
            </a>
          )}
        </div>
        {data.owner ? (
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
            <Field label="Name">{data.owner.fullName ?? '—'}</Field>
            <Field label="Email">{data.owner.email ?? '—'}</Field>
            <Field label="Phone">{data.owner.phone ?? '—'}</Field>
          </div>
        ) : (
          <div className="text-sm text-ink-soft">No owner linked. (Edge case — investigate.)</div>
        )}
      </section>

      {/* Identity / Location / Hours — editable when in edit mode */}
      {editing && form ? (
        <EditForm form={form} setForm={setForm} />
      ) : (
        <ReadOnlyView v={data} />
      )}

      {/* Bays + Services (read-only — owner manages these) */}
      <section className="card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Bays</h2>
          <span className="text-xs text-ink-soft">Owner manages from /bays</span>
        </div>
        {data.bays.length === 0 ? (
          <div className="text-sm text-ink-soft">No bays yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {data.bays.map((b) => (
              <div
                key={b.id}
                className="rounded-lg border border-mint-edge bg-white px-3 py-2 text-sm"
              >
                <div className="font-semibold text-ink">{b.name}</div>
                <div className="text-[11px] text-ink-soft">
                  {b.bayType} · <span className="font-semibold">{b.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Services</h2>
          <span className="text-xs text-ink-soft">Owner manages from /services</span>
        </div>
        {data.services.length === 0 ? (
          <div className="text-sm text-ink-soft">No services yet.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-mint">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-primary-deep">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-right">Duration</th>
                <th className="px-3 py-2 text-right">Price (AED)</th>
                <th className="px-3 py-2">VAT</th>
              </tr>
            </thead>
            <tbody>
              {data.services.map((s) => (
                <tr key={s.id} className="border-t border-mint-edge">
                  <td className="px-3 py-2 text-ink">{s.name}</td>
                  <td className="px-3 py-2 text-right text-ink-soft">{s.durationMin} min</td>
                  <td className="px-3 py-2 text-right font-bold text-primary-deep">
                    AED {s.priceAed}
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{s.vatInclusive ? 'Inc.' : 'Excl.'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="flex justify-end">
        <button
          className="text-xs text-ink-soft hover:text-ink hover:underline"
          onClick={() => navigate('/platform/vendors')}
        >
          ← Back to vendors
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card py-3">
      <div className="label-eyebrow mb-1">{label}</div>
      <div className="text-2xl font-bold text-ink">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label-eyebrow mb-0.5">{label}</div>
      <div className="font-semibold text-ink">{children}</div>
    </div>
  );
}

function StatusPill({ status }: { status: VendorStatus }) {
  const tone =
    status === 'active'
      ? 'bg-mint text-primary-deep'
      : status === 'pending'
        ? 'bg-amber/30 text-ink'
        : 'bg-coral-soft text-coral';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}
    >
      {status}
    </span>
  );
}

function ReadOnlyView({ v }: { v: PlatformVendorDetail }) {
  return (
    <>
      <section className="card flex flex-col gap-3">
        <h2 className="text-lg font-bold text-ink">Identity</h2>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <Field label="Brand name">{v.brandName}</Field>
          <Field label="Trade license">{v.tradeLicenseNo ?? '—'}</Field>
          <Field label="Logo URL">
            {v.logoUrl ? (
              <a
                href={v.logoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary-deep hover:underline"
              >
                {truncate(v.logoUrl, 40)}
              </a>
            ) : (
              '—'
            )}
          </Field>
        </div>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-lg font-bold text-ink">Location</h2>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <Field label="Emirate">{prettyEmirate(v.emirate)}</Field>
          <Field label="City / Area">{v.city}</Field>
          <Field label="Address">{v.addressLine ?? '—'}</Field>
          <Field label="Latitude">{v.lat}</Field>
          <Field label="Longitude">{v.lng}</Field>
          <Field label="Map">
            <a
              className="text-primary-deep hover:underline"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps?q=${v.lat},${v.lng}`}
            >
              Open in Google Maps ↗
            </a>
          </Field>
        </div>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-lg font-bold text-ink">Operating hours</h2>
        {v.hours ? (
          <div className="grid grid-cols-1 gap-1.5 text-sm md:grid-cols-7">
            {DAY_LABELS.map(({ key, label }) => {
              const h = v.hours?.[key] ?? null;
              return (
                <div
                  key={key}
                  className="rounded-lg border border-mint-edge bg-white px-2 py-1.5 text-center"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary-deep">
                    {label}
                  </div>
                  <div className="mt-0.5 text-xs text-ink">
                    {h ? `${h.open}–${h.close}` : 'Closed'}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-ink-soft">Hours not set.</div>
        )}
      </section>
    </>
  );
}

function EditForm({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState | null>>;
}) {
  const update = (patch: Partial<FormState>) => setForm((f) => f && { ...f, ...patch });

  return (
    <>
      <section className="card flex flex-col gap-3">
        <h2 className="text-lg font-bold text-ink">Identity</h2>
        <EditField label="Brand name">
          <input
            className="input"
            value={form.brandName}
            onChange={(e) => update({ brandName: e.target.value })}
          />
        </EditField>
        <EditField label="Trade license number">
          <input
            className="input"
            value={form.tradeLicenseNo}
            placeholder="CN-1234567"
            onChange={(e) => update({ tradeLicenseNo: e.target.value })}
          />
        </EditField>
        <EditField label="Logo URL">
          <input
            className="input"
            value={form.logoUrl}
            placeholder="https://…/logo.png"
            onChange={(e) => update({ logoUrl: e.target.value })}
          />
        </EditField>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-lg font-bold text-ink">Location</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <EditField label="Emirate">
            <select
              className="input"
              value={form.emirate}
              onChange={(e) => update({ emirate: e.target.value as Emirate })}
            >
              {EMIRATES.map((em) => (
                <option key={em.value} value={em.value}>
                  {em.label}
                </option>
              ))}
            </select>
          </EditField>
          <EditField label="City / Area">
            <input
              className="input"
              value={form.city}
              onChange={(e) => update({ city: e.target.value })}
            />
          </EditField>
        </div>
        <EditField label="Street address">
          <input
            className="input"
            value={form.addressLine}
            onChange={(e) => update({ addressLine: e.target.value })}
          />
        </EditField>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <EditField label="Latitude">
            <input
              className="input"
              inputMode="decimal"
              value={form.lat}
              onChange={(e) => update({ lat: e.target.value })}
            />
          </EditField>
          <EditField label="Longitude">
            <input
              className="input"
              inputMode="decimal"
              value={form.lng}
              onChange={(e) => update({ lng: e.target.value })}
            />
          </EditField>
        </div>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-lg font-bold text-ink">Operating hours</h2>
        <HoursEditor hours={form.hours} onChange={(h) => update({ hours: h })} />
      </section>
    </>
  );
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-eyebrow">{label}</span>
      {children}
    </label>
  );
}

function HoursEditor({
  hours,
  onChange,
}: {
  hours: WeeklyHours;
  onChange: (h: WeeklyHours) => void;
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
                disabled={!isOpen}
                onChange={(e) =>
                  setDay(key, { open: e.target.value, close: dayHours?.close ?? '22:00' })
                }
              />
              <span className="text-ink-soft">→</span>
              <input
                type="time"
                className="input w-28"
                value={dayHours?.close ?? '22:00'}
                disabled={!isOpen}
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

function prettyEmirate(e: string): string {
  switch (e) {
    case 'AbuDhabi':
      return 'Abu Dhabi';
    case 'UmmAlQuwain':
      return 'Umm Al Quwain';
    case 'RasAlKhaimah':
      return 'Ras Al Khaimah';
    default:
      return e;
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } }).response;
    return resp?.data?.error?.message ?? 'Couldn’t save changes';
  }
  return e instanceof Error ? e.message : 'Couldn’t save changes';
}
