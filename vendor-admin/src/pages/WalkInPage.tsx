// Walk-in scheduler. Vendor staff sees today's bay × time grid; click an
// empty cell to record a walk-in starting at that slot. Booked cells (both
// customer-app reservations AND prior walk-ins) appear greyed out so we
// never offer the same slot twice. Subscribes to the `booking:changed`
// socket event so newly-booked cells disappear in real time.

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createWalkIn,
  getAvailability,
  type AvailabilityBay,
  type AvailabilityBooking,
  type AvailabilityResponse,
  type AvailabilityService,
} from '../api/admin';
import { getRealtimeSocket } from '../api/realtime';

interface SlotKey {
  bayId: string;
  startsAt: string; // ISO
}

export default function WalkInPage() {
  const qc = useQueryClient();
  // Date picker state. Default = today (UAE-local). YYYY-MM-DD string is
  // both the API param and the <input type="date"> value.
  const [date, setDate] = useState<string>(() => todayUaeIso());

  const { data, isLoading, error } = useQuery({
    queryKey: ['availability', date],
    queryFn: () => getAvailability(date),
    refetchInterval: 30_000, // safety net; socket pushes are primary
  });

  // Refetch availability whenever the backend tells us a booking changed
  // (customer paid via the app, vendor staff cancelled, walk-in created
  // from another tab, etc.). The vendor's id arrives via getMe; the socket
  // is already in the vendor:{id} room because BayBoard subscribed it.
  useEffect(() => {
    const sock = getRealtimeSocket();
    const onChanged = () => qc.invalidateQueries({ queryKey: ['availability'] });
    sock.on('booking:changed', onChanged);
    return () => {
      sock.off('booking:changed', onChanged);
    };
  }, [qc]);

  const [picked, setPicked] = useState<SlotKey | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="label-eyebrow mb-1">Schedule</div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Walk-in scheduler</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Tap any open slot to record a walk-in. Slots booked from the customer app or
          previous walk-ins are greyed out and update in real time.
        </p>
      </header>

      <DatePicker value={date} onChange={setDate} />

      {isLoading && <div className="text-ink-soft">Loading availability…</div>}
      {error && <div className="text-coral">Couldn't load availability.</div>}

      {data && (
        <>
          <Legend />
          <CalendarGrid availability={data} onPick={(k) => setPicked(k)} />
        </>
      )}

      {picked && data && (
        <WalkInDialog
          slot={picked}
          bays={data.bays}
          services={data.services}
          onClose={() => setPicked(null)}
          onCreated={() => {
            setPicked(null);
            qc.invalidateQueries({ queryKey: ['availability'] });
            qc.invalidateQueries({ queryKey: ['me'] });
            qc.invalidateQueries({ queryKey: ['bookings', 'today'] });
          }}
        />
      )}
    </div>
  );
}

// ─── Date picker ─────────────────────────────────────────────────────────
//
// Native <input type="date"> for the precise pick, plus a row of one-tap
// shortcuts (Today / Tomorrow / +2 / +3 / +4 / +5 / +6) that mirror the
// customer-side booking window. Vendor staff usually books just today or
// next-day, so the shortcuts cover 99% of taps.

function DatePicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const today = todayUaeIso();
  const shortcuts = [0, 1, 2, 3, 4, 5, 6].map((offset) => ({
    iso: shiftIso(today, offset),
    label:
      offset === 0
        ? 'Today'
        : offset === 1
          ? 'Tomorrow'
          : new Date(`${shiftIso(today, offset)}T00:00:00+04:00`).toLocaleDateString(undefined, {
              weekday: 'short',
              day: 'numeric',
            }),
  }));

  return (
    <section className="card flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        <span className="label-eyebrow">Date</span>
        <input
          type="date"
          className="input w-44"
          value={value}
          min={today}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {shortcuts.map((s) => (
          <button
            key={s.iso}
            onClick={() => onChange(s.iso)}
            className={[
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
              value === s.iso
                ? 'border-primary-deep bg-primary-deep text-white'
                : 'border-mint-edge bg-white text-ink-soft hover:text-ink',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function todayUaeIso(): string {
  // UAE is GMT+4. Convert local Date to UAE wall-clock and slice the date.
  return new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10);
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00+04:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
      <LegendChip color="bg-white border-mint-edge text-ink" label="Open" />
      <LegendChip color="bg-coral-soft border-coral text-coral" label="Booked" />
      <LegendChip color="bg-amber/30 border-amber text-ink" label="Walk-in (yours)" />
      <LegendChip color="bg-mint-edge/40 border-mint-edge text-ink-soft" label="Past / closed" />
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className={`flex items-center gap-2`}>
      <span className={`inline-block h-3 w-5 rounded border ${color}`} />
      {label}
    </span>
  );
}

// ─── Calendar grid ───────────────────────────────────────────────────────
//
// Rows = 30-min time slots from openingHour to closingHour. Columns = bays
// (sticky header). Each cell = one (bay, slot) pair.

function CalendarGrid({
  availability,
  onPick,
}: {
  availability: AvailabilityResponse;
  onPick: (key: SlotKey) => void;
}) {
  const { date, openingHour, closingHour, intervalMin, bays, bookings } = availability;

  // Build the row anchors: ISO strings for each slot start, in UAE-tz day.
  const slots = useMemo(() => buildSlots(date, openingHour, closingHour, intervalMin), [
    date,
    openingHour,
    closingHour,
    intervalMin,
  ]);

  // Index bookings by bayId for fast lookup. Each booking spans potentially
  // multiple 30-min slots; we mark every covered cell as booked + remember
  // which booking is the cell's anchor (for tooltip text).
  const byBay = useMemo(() => indexBookings(bookings, bays), [bookings, bays]);

  const now = new Date();

  if (bays.length === 0) {
    return (
      <div className="card text-sm text-ink-soft">
        No bays configured yet. Add a bay on the <strong>Bay board</strong> first.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-mint">
            <tr>
              <th className="sticky left-0 bg-mint px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-primary-deep">
                Time
              </th>
              {bays.map((bay) => (
                <th
                  key={bay.id}
                  className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-primary-deep"
                >
                  {bay.name}
                  <div className="text-[9px] font-normal normal-case text-ink-soft">
                    {bay.bayType}
                    {bay.status === 'closed' && ' · closed'}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, i) => (
              <tr key={slot.iso} className={i % 2 === 0 ? 'bg-white' : 'bg-cream'}>
                <td className="sticky left-0 z-10 border-r border-mint-edge bg-inherit px-3 py-2 text-xs font-semibold tabular-nums text-ink">
                  {slot.label}
                </td>
                {bays.map((bay) => (
                  <Cell
                    key={bay.id + slot.iso}
                    bay={bay}
                    slotIso={slot.iso}
                    slotEnd={slot.endIso}
                    booking={byBay.get(bay.id)?.find((b) => b.slotStart <= slot.iso && b.slotEnd > slot.iso) ?? null}
                    isPast={new Date(slot.iso) < now}
                    onPick={onPick}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({
  bay,
  slotIso,
  booking,
  isPast,
  onPick,
}: {
  bay: AvailabilityBay;
  slotIso: string;
  slotEnd: string;
  booking: AvailabilityBooking | null;
  isPast: boolean;
  onPick: (key: SlotKey) => void;
}) {
  if (booking) {
    const tone = booking.isWalkIn
      ? 'bg-amber/30 border-amber text-ink'
      : 'bg-coral-soft border-coral text-coral';
    return (
      <td
        className={`min-w-[120px] border ${tone} px-2 py-2 align-middle`}
        title={`${booking.customerName ?? '(no name)'} · ${booking.status}`}
      >
        <div className="text-[11px] font-semibold truncate">
          {booking.customerName ?? '—'}
        </div>
        <div className="text-[9px] uppercase tracking-wider opacity-70">
          {booking.isWalkIn ? 'Walk-in' : 'Booked'}
        </div>
      </td>
    );
  }

  if (isPast || bay.status === 'closed') {
    return (
      <td className="min-w-[120px] border border-mint-edge bg-mint-edge/40 px-2 py-2 align-middle text-[11px] text-ink-soft">
        —
      </td>
    );
  }

  return (
    <td className="min-w-[120px] border border-mint-edge bg-white p-0 align-middle">
      <button
        onClick={() => onPick({ bayId: bay.id, startsAt: slotIso })}
        className="h-full w-full px-2 py-2 text-left text-[11px] font-semibold text-primary-deep hover:bg-mint"
      >
        Open · tap
      </button>
    </td>
  );
}

// ─── Walk-in dialog ──────────────────────────────────────────────────────

function WalkInDialog({
  slot,
  bays,
  services,
  onClose,
  onCreated,
}: {
  slot: SlotKey;
  bays: AvailabilityBay[];
  services: AvailabilityService[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const bay = bays.find((b) => b.id === slot.bayId);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: createWalkIn,
    onSuccess: onCreated,
    onError: (e: unknown) => setError(extractError(e)),
  });

  function submit() {
    setError(null);
    if (!serviceId) return setError('Pick a service.');
    if (phone && !/^\+?[1-9]\d{6,14}$/.test(phone.trim())) {
      return setError('Phone must be E.164-ish (e.g. +971501234567).');
    }
    create.mutate({
      bayId: slot.bayId,
      serviceId,
      slotStart: slot.startsAt,
      walkInName: name.trim() || undefined,
      walkInPhone: phone.trim() || undefined,
    });
  }

  const selected = services.find((s) => s.id === serviceId);
  const slotTime = new Date(slot.startsAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="card w-full max-w-md">
        <div className="mb-3">
          <div className="label-eyebrow">Walk-in</div>
          <h2 className="text-xl font-bold text-ink">
            {bay?.name ?? '?'} · {slotTime}
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="label-eyebrow">Service</span>
            <select
              className="input"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              autoFocus
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — AED {s.priceAed} ({s.durationMin}m)
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-eyebrow">Customer name (optional)</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mohamed"
              maxLength={80}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-eyebrow">Phone (optional)</span>
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+971501234567"
              inputMode="tel"
            />
          </label>
        </div>

        {selected && (
          <div className="mt-3 text-xs text-ink-soft">
            Total: <strong className="text-ink">AED {selected.priceAed}</strong> · Duration{' '}
            {selected.durationMin}m
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral">{error}</div>
        )}

        <div className="mt-4 flex justify-end gap-3">
          <button
            className="btn-text px-4 py-2"
            onClick={onClose}
            disabled={create.isPending}
          >
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Recording…' : 'Start walk-in'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function buildSlots(
  isoDate: string,
  openingHour: number,
  closingHour: number,
  intervalMin: number,
): { iso: string; endIso: string; label: string }[] {
  // UAE is GMT+4, no DST. Build slots in that timezone.
  const start = new Date(`${isoDate}T${pad(openingHour)}:00:00+04:00`);
  const end = new Date(`${isoDate}T${pad(closingHour)}:00:00+04:00`);
  const slots: { iso: string; endIso: string; label: string }[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += intervalMin * 60_000) {
    const cursor = new Date(t);
    const cursorEnd = new Date(t + intervalMin * 60_000);
    slots.push({
      iso: cursor.toISOString(),
      endIso: cursorEnd.toISOString(),
      label: cursor.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    });
  }
  return slots;
}

function indexBookings(
  bookings: AvailabilityBooking[],
  _bays: AvailabilityBay[],
): Map<string, AvailabilityBooking[]> {
  const map = new Map<string, AvailabilityBooking[]>();
  for (const b of bookings) {
    const arr = map.get(b.bayId) ?? [];
    arr.push(b);
    map.set(b.bayId, arr);
  }
  return map;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } }).response;
    return resp?.data?.error?.message ?? "Couldn't record walk-in.";
  }
  return e instanceof Error ? e.message : "Couldn't record walk-in.";
}
