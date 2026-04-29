// Platform super-admin: every vendor on the system. Inline approve / suspend
// actions, link to the onboarding form, link to /admin so the platform admin
// can also impersonate a vendor's view by signing in as that owner.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listPlatformVendors, setVendorStatus, type PlatformVendor } from '../api/platform';
import type { VendorStatus } from '../api/admin';

const STATUS_FILTERS: { key: VendorStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
];

export default function PlatformVendorsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'vendors'],
    queryFn: listPlatformVendors,
  });
  const [filter, setFilter] = useState<VendorStatus | 'all'>('all');

  const flip = useMutation({
    mutationFn: ({ id, status }: { id: string; status: VendorStatus }) => setVendorStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform', 'vendors'] }),
  });

  if (isLoading) return <div className="text-ink-soft">Loading vendors…</div>;

  const items = (data?.items ?? []).filter((v) => filter === 'all' || v.status === filter);
  const counts = {
    pending: data?.items.filter((v) => v.status === 'pending').length ?? 0,
    active: data?.items.filter((v) => v.status === 'active').length ?? 0,
    suspended: data?.items.filter((v) => v.status === 'suspended').length ?? 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="label-eyebrow mb-1">Platform</div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Vendors</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {counts.pending} awaiting approval · {counts.active} live · {counts.suspended} suspended.
          </p>
        </div>
        <Link to="/platform/vendors/new" className="btn-primary">
          + Onboard vendor
        </Link>
      </header>

      <div className="flex gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={[
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
              filter === f.key
                ? 'border-primary-deep bg-primary-deep text-white'
                : 'border-mint-edge bg-white text-ink-soft hover:text-ink',
            ].join(' ')}
          >
            {f.label}
            {f.key !== 'all' && (
              <span className="ml-1.5 opacity-70">{counts[f.key as keyof typeof counts]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-mint">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-primary-deep">
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3 text-right">Bays · Services · Bookings</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-ink-soft">
                  No vendors match this filter.
                </td>
              </tr>
            )}
            {items.map((v) => (
              <VendorRow
                key={v.id}
                v={v}
                onFlip={(status) => flip.mutate({ id: v.id, status })}
                pending={flip.isPending}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VendorRow({
  v,
  onFlip,
  pending,
}: {
  v: PlatformVendor;
  onFlip: (status: VendorStatus) => void;
  pending: boolean;
}) {
  return (
    <tr className="border-t border-mint-edge align-top hover:bg-mint/30">
      <td className="px-4 py-3">
        <Link
          to={`/platform/vendors/${v.id}`}
          className="font-semibold text-ink hover:text-primary-deep hover:underline"
        >
          {v.brandName}
        </Link>
        {v.tradeLicenseNo && (
          <div className="text-[11px] text-ink-soft">{v.tradeLicenseNo}</div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="text-ink">{v.owner?.fullName ?? '—'}</div>
        <div className="text-[11px] text-ink-soft">{v.owner?.email ?? v.owner?.phone ?? '—'}</div>
      </td>
      <td className="px-4 py-3">
        <div className="text-ink">{prettyEmirate(v.emirate)}</div>
        <div className="text-[11px] text-ink-soft">{v.city}</div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-ink-soft">
        {v.counts.bays} · {v.counts.services} · {v.counts.bookings}
      </td>
      <td className="px-4 py-3">
        <StatusPill status={v.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-2">
          {v.status === 'pending' && (
            <ActionButton kind="primary" onClick={() => onFlip('active')} disabled={pending}>
              Approve
            </ActionButton>
          )}
          {v.status === 'active' && (
            <ActionButton kind="danger" onClick={() => onFlip('suspended')} disabled={pending}>
              Suspend
            </ActionButton>
          )}
          {v.status === 'suspended' && (
            <ActionButton kind="primary" onClick={() => onFlip('active')} disabled={pending}>
              Reactivate
            </ActionButton>
          )}
        </div>
      </td>
    </tr>
  );
}

function ActionButton({
  kind,
  onClick,
  disabled,
  children,
}: {
  kind: 'primary' | 'danger';
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const styles =
    kind === 'primary'
      ? 'bg-primary-deep text-white hover:bg-primary-deep/90'
      : 'bg-coral-soft text-coral hover:bg-coral-soft/80';
  return (
    <button
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${styles}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
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
