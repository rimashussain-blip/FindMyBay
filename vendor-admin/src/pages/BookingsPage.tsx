import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTodayBookings, setBookingStatus } from '../api/admin';

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Pending payment',
  confirmed: 'Confirmed',
  alert_scheduled: 'Alert scheduled',
  alerted: 'Alerted',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

export default function BookingsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['bookings-today'],
    queryFn: getTodayBookings,
    refetchInterval: 8_000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => setBookingStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings-today'] }),
  });

  if (isLoading) return <div className="text-ink-soft">Loading…</div>;
  if (error) return <div className="text-coral">Couldn't load bookings.</div>;

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="label-eyebrow mb-1">Next 7 days</div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Bookings</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {items.length} booking{items.length === 1 ? '' : 's'} scheduled.
        </p>
      </header>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-mint">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-primary-deep">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Bay</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-ink-soft">
                  No bookings yet today.
                </td>
              </tr>
            )}
            {items.map((b) => (
              <tr key={b.id} className="border-t border-mint-edge">
                <td className="px-4 py-3 font-medium text-ink">{formatTime(b.slotStart)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-ink">
                    {b.customer.fullName ?? '—'}
                    {b.isWalkIn && (
                      <span className="rounded-full bg-amber/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">
                        Walk-in
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-ink-soft">{b.customer.phone ?? '—'}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-ink">{b.service.name}</div>
                  <div className="text-[11px] text-ink-soft">{b.service.durationMin} min</div>
                </td>
                <td className="px-4 py-3 text-ink-soft">{b.bay.name}</td>
                <td className="px-4 py-3 text-right font-bold text-primary-deep">AED {b.totalAed}</td>
                <td className="px-4 py-3">
                  <StatusChip status={b.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <ActionButton
                    booking={b}
                    onAction={(status) => updateStatus.mutate({ id: b.id, status })}
                    pending={updateStatus.isPending}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status;
  const colors: Record<string, string> = {
    confirmed: 'bg-mint text-primary-deep',
    alert_scheduled: 'bg-mint text-primary-deep',
    alerted: 'bg-sand text-ink',
    in_progress: 'bg-primary text-white',
    completed: 'bg-mint-edge text-ink-soft',
    cancelled: 'bg-coral-soft text-coral',
    no_show: 'bg-coral-soft text-coral',
    pending_payment: 'bg-sand text-ink',
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${colors[status] ?? 'bg-mint-edge text-ink-soft'}`}>
      {label}
    </span>
  );
}

function ActionButton({
  booking,
  onAction,
  pending,
}: {
  booking: { status: string; id: string };
  onAction: (status: string) => void;
  pending: boolean;
}) {
  if (booking.status === 'confirmed' || booking.status === 'alert_scheduled' || booking.status === 'alerted') {
    return (
      <button
        className="btn-primary px-3 py-1.5 text-xs"
        onClick={() => onAction('in_progress')}
        disabled={pending}
      >
        Start
      </button>
    );
  }
  if (booking.status === 'in_progress') {
    return (
      <button
        className="btn-primary px-3 py-1.5 text-xs"
        onClick={() => onAction('completed')}
        disabled={pending}
      >
        Complete
      </button>
    );
  }
  return <span className="text-xs text-ink-soft">—</span>;
}

function formatTime(iso: string): string {
  // Show date + time when the row spans multiple days. Today renders just HH:mm.
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (sameDay) return time;
  const day = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} · ${time}`;
}
