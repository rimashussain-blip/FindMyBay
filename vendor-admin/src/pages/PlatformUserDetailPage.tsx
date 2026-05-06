// Platform super-admin: drill-down for a single customer. Shows the full
// profile + their booking history. Read-only for V1.

import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPlatformUser, type PlatformUserBooking } from '../api/platform';

export default function PlatformUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: u, isLoading, error } = useQuery({
    queryKey: ['platform', 'user', id],
    queryFn: () => getPlatformUser(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="text-ink-soft">Loading user…</div>;
  if (error || !u) {
    return (
      <div className="flex flex-col gap-3">
        <Link to="/platform/users" className="text-sm text-primary-deep hover:underline">
          ← Back to users
        </Link>
        <div className="rounded-xl bg-coral-soft/40 p-4 text-coral">
          User not found, or you don't have access.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/platform/users" className="text-sm text-primary-deep hover:underline">
          ← Back to users
        </Link>
      </div>

      <header>
        <div className="label-eyebrow mb-1">App user</div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{u.fullName ?? '(no name)'}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Joined {new Date(u.createdAt).toLocaleString()}
          {' · '}
          {u.profileComplete ? 'Profile complete' : 'Partial profile'}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Contact">
          <Field label="Email" value={u.email} />
          <Field label="Phone" value={u.phone} />
        </Card>

        <Card title="Car profile">
          <Field
            label="Vehicle"
            value={
              [u.carColor, u.carMake].filter(Boolean).join(' ') +
              (u.carType ? ` (${u.carType})` : '') || null
            }
          />
          <Field label="Plate" value={u.carPlate} />
        </Card>

        <Card title="Last known location">
          {u.lastLat != null && u.lastLng != null ? (
            <>
              <Field label="Coords" value={`${u.lastLat.toFixed(5)}, ${u.lastLng.toFixed(5)}`} />
              <Field
                label="Reported"
                value={u.lastLocationAt ? new Date(u.lastLocationAt).toLocaleString() : null}
              />
            </>
          ) : (
            <p className="text-xs text-ink-soft">No location reported yet.</p>
          )}
        </Card>

        <Card title="Activity">
          <Field label="Total bookings" value={String(u.bookings.length)} />
          {u.bookings[0] && (
            <Field
              label="Latest booking"
              value={new Date(u.bookings[0].slotStart).toLocaleString()}
            />
          )}
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Booking history</h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-mint">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-primary-deep">
                <th className="px-4 py-3">Slot</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3 text-right">AED</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {u.bookings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-ink-soft">
                    No bookings yet.
                  </td>
                </tr>
              )}
              {u.bookings.map((b) => (
                <BookingRow key={b.id} b={b} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="label-eyebrow">{title}</div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-28 shrink-0 text-[11px] uppercase tracking-wider text-ink-soft">
        {label}
      </span>
      <span className="text-sm text-ink">{value ?? '—'}</span>
    </div>
  );
}

function BookingRow({ b }: { b: PlatformUserBooking }) {
  return (
    <tr className="border-t border-mint-edge align-top">
      <td className="px-4 py-3 text-ink">{new Date(b.slotStart).toLocaleString()}</td>
      <td className="px-4 py-3">
        <Link
          to={`/platform/vendors/${b.vendor.id}`}
          className="text-ink hover:text-primary-deep hover:underline"
        >
          {b.vendor.brandName}
        </Link>
        <div className="text-[11px] text-ink-soft">{b.vendor.city}</div>
      </td>
      <td className="px-4 py-3 text-ink">{b.service.name}</td>
      <td className="px-4 py-3 text-right tabular-nums text-ink">{b.totalAed}</td>
      <td className="px-4 py-3">
        <BookingStatusPill status={b.status} />
      </td>
    </tr>
  );
}

function BookingStatusPill({ status }: { status: string }) {
  // Mint for terminal-positive, coral for terminal-negative, amber for in-flight.
  const tone =
    status === 'completed'
      ? 'bg-mint text-primary-deep'
      : status === 'cancelled' || status === 'no_show'
        ? 'bg-coral-soft text-coral'
        : 'bg-amber/30 text-ink';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
