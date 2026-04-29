// Platform super-admin: create a new vendor + owner User in one shot.
// On success, the temp password (if a brand-new user was created) is shown
// once with a copy button — admin must hand it to the vendor securely.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createPlatformVendor, type CreateVendorBody, type CreateVendorResponse } from '../api/platform';
import type { Emirate } from '../api/admin';

const EMIRATES: { value: Emirate; label: string }[] = [
  { value: 'Dubai', label: 'Dubai' },
  { value: 'AbuDhabi', label: 'Abu Dhabi' },
  { value: 'Sharjah', label: 'Sharjah' },
  { value: 'Ajman', label: 'Ajman' },
  { value: 'UmmAlQuwain', label: 'Umm Al Quwain' },
  { value: 'RasAlKhaimah', label: 'Ras Al Khaimah' },
  { value: 'Fujairah', label: 'Fujairah' },
];

interface FormState {
  brandName: string;
  emirate: Emirate;
  city: string;
  addressLine: string;
  lat: string;
  lng: string;
  tradeLicenseNo: string;
  ownerEmail: string;
  ownerFullName: string;
}

const EMPTY: FormState = {
  brandName: '',
  emirate: 'Dubai',
  city: '',
  addressLine: '',
  lat: '',
  lng: '',
  tradeLicenseNo: '',
  ownerEmail: '',
  ownerFullName: '',
};

export default function PlatformNewVendorPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateVendorResponse | null>(null);

  const create = useMutation({
    mutationFn: (body: CreateVendorBody) => createPlatformVendor(body),
    onSuccess: (data) => {
      setResult(data);
      setForm(EMPTY);
    },
    onError: (e: unknown) => setError(extractError(e)),
  });

  if (result) {
    return <SuccessCard result={result} onDone={() => navigate('/platform/vendors')} />;
  }

  function submit() {
    setError(null);
    if (!form.brandName.trim()) return setError('Brand name is required.');
    if (!form.city.trim()) return setError('City is required.');
    if (!form.ownerEmail.trim()) return setError('Owner email is required.');
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90)
      return setError('Latitude must be a number between -90 and 90.');
    if (!Number.isFinite(lng) || lng < -180 || lng > 180)
      return setError('Longitude must be a number between -180 and 180.');

    create.mutate({
      brandName: form.brandName.trim(),
      emirate: form.emirate,
      city: form.city.trim(),
      addressLine: form.addressLine.trim() || undefined,
      tradeLicenseNo: form.tradeLicenseNo.trim() || undefined,
      lat,
      lng,
      ownerEmail: form.ownerEmail.trim().toLowerCase(),
      ownerFullName: form.ownerFullName.trim() || undefined,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="label-eyebrow mb-1">Platform</div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Onboard a vendor</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Creates the vendor in <strong>pending</strong> status and an owner account they can sign
          in with. Approve the vendor once you've verified their trade license.
        </p>
      </header>

      {error && <div className="card border-coral bg-coral-soft text-sm text-coral">{error}</div>}

      <section className="card flex flex-col gap-4">
        <h2 className="text-lg font-bold text-ink">Brand</h2>
        <Field label="Brand name">
          <input
            className="input"
            value={form.brandName}
            onChange={(e) => setForm({ ...form, brandName: e.target.value })}
            placeholder="Polaris Wash JLT"
          />
        </Field>
        <Field label="Trade license number" hint="Optional now; required before approval.">
          <input
            className="input"
            value={form.tradeLicenseNo}
            onChange={(e) => setForm({ ...form, tradeLicenseNo: e.target.value })}
            placeholder="CN-1234567"
          />
        </Field>
      </section>

      <section className="card flex flex-col gap-4">
        <h2 className="text-lg font-bold text-ink">Location</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Emirate">
            <select
              className="input"
              value={form.emirate}
              onChange={(e) => setForm({ ...form, emirate: e.target.value as Emirate })}
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
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Business Bay"
            />
          </Field>
        </div>
        <Field label="Street address">
          <input
            className="input"
            value={form.addressLine}
            onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
            placeholder="Building 12, Sheikh Zayed Rd"
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
              inputMode="decimal"
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
              placeholder="25.1972"
            />
          </Field>
          <Field label="Longitude">
            <input
              className="input"
              inputMode="decimal"
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
              placeholder="55.2744"
            />
          </Field>
        </div>
      </section>

      <section className="card flex flex-col gap-4">
        <h2 className="text-lg font-bold text-ink">Owner account</h2>
        <p className="text-xs text-ink-soft">
          We'll create a vendor-owner account at this email and return a temp password the owner
          uses for first sign-in. They can change it from their profile after.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Owner full name">
            <input
              className="input"
              value={form.ownerFullName}
              onChange={(e) => setForm({ ...form, ownerFullName: e.target.value })}
              placeholder="Sara Hassan"
            />
          </Field>
          <Field label="Owner email">
            <input
              className="input"
              type="email"
              value={form.ownerEmail}
              onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
              placeholder="owner@business.ae"
            />
          </Field>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Link to="/platform/vendors" className="btn-text px-4 py-2">
          Cancel
        </Link>
        <button className="btn-primary" onClick={submit} disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create vendor'}
        </button>
      </div>
    </div>
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

function SuccessCard({
  result,
  onDone,
}: {
  result: CreateVendorResponse;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!result.owner.tempPassword) return;
    navigator.clipboard.writeText(result.owner.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="label-eyebrow mb-1 text-primary-deep">✓ Vendor created</div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{result.vendor.brandName}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Status is <strong>pending</strong>. Approve from the vendor list once you've verified
          their trade license.
        </p>
      </header>

      <section className="card flex flex-col gap-3">
        <h2 className="text-lg font-bold text-ink">Owner credentials</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Email">{result.owner.email}</Stat>
          <Stat label="Name">{result.owner.fullName ?? '—'}</Stat>
        </div>

        {result.owner.tempPassword ? (
          <div
            className="mt-2 rounded-xl border border-amber/40 p-4"
            style={{ background: 'linear-gradient(135deg, #FCE7C8 0%, #FFE3D9 100%)' }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-coral">
              ⚠ One-time temp password — copy now
            </div>
            <div className="mt-2 flex items-center gap-3">
              <code className="flex-1 rounded-lg bg-white px-3 py-2 font-mono text-base font-bold text-ink">
                {result.owner.tempPassword}
              </code>
              <button onClick={copy} className="btn-primary">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="mt-2 text-[11px] text-ink-soft">
              We won't show this again. Share it with the vendor over a secure channel; they can
              change it after first sign-in.
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-mint p-3 text-xs text-primary-deep">
            This email already had an account, so we just linked them as the vendor owner. No new
            password was generated — the owner uses their existing one.
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={onDone}>
          Back to vendor list
        </button>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label-eyebrow mb-0.5">{label}</div>
      <div className="font-semibold text-ink">{children}</div>
    </div>
  );
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } }).response;
    return resp?.data?.error?.message ?? 'Couldn’t create vendor';
  }
  return e instanceof Error ? e.message : 'Couldn’t create vendor';
}
