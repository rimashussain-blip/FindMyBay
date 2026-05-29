// Walk-in scheduler. Vendor staff sees today's bay × time grid; click an
// empty cell to record a walk-in starting at that slot. Booked cells (both
// customer-app reservations AND prior walk-ins) appear greyed out so we
// never offer the same slot twice. Subscribes to the `booking:changed`
// socket event so newly-booked cells disappear in real time.
//
// Layout & visual language match findMy Bay's design handoff:
// `findMy Bay Vendor Walk-in.html`. The grid is CSS-grid (not <table>) so
// the period bands, rich slot pills, and stats row sit cleanly alongside
// the same data the API already returns.

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
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
      <Header />

      {data && <StatsRow availability={data} />}

      <Toolbar value={date} onChange={setDate} />

      <Legend />

      {isLoading && <div className="text-ink-soft">Loading availability…</div>}
      {error && <div className="text-coral">Couldn't load availability.</div>}

      {data && <Schedule availability={data} onPick={(k) => setPicked(k)} />}

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

// ─── Header ──────────────────────────────────────────────────────────────

function Header() {
  return (
    <header>
      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary-deep">
        <span>Schedule</span>
        <span className="text-ink-soft opacity-50">/</span>
        <span className="text-ink-soft">Walk-in</span>
      </div>
      <h1 className="mt-2.5 text-[38px] font-extrabold leading-tight tracking-tight text-ink">
        Walk-in scheduler
      </h1>
      <p className="mt-2.5 max-w-[720px] text-sm leading-[1.55] text-ink-soft">
        Tap any open slot to record a walk-in. Slots booked from the customer app or
        previous walk-ins update in real time — no refresh needed.
      </p>
    </header>
  );
}

// ─── Stats row ───────────────────────────────────────────────────────────

function StatsRow({ availability }: { availability: AvailabilityResponse }) {
  const stats = useMemo(() => computeStats(availability), [availability]);

  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
      <StatCard
        accent
        label="Open slots today"
        value={String(stats.openCells)}
        unit={`/ ${stats.totalCells}`}
        trend={stats.nextFreeLabel ? `→ next free: ${stats.nextFreeLabel}` : 'No free slots remaining'}
      />
      <StatCard
        label="Booked from app"
        value={String(stats.appBookedCount)}
        unit="today"
        trend="Customer reservations"
      />
      <StatCard
        label="Walk-ins recorded"
        value={String(stats.walkInCount)}
        unit="today"
        trend={stats.lastWalkInLabel ? `Last: ${stats.lastWalkInLabel}` : 'None yet today'}
      />
      <StatCard
        warm
        label="Utilization"
        value={String(stats.utilizationPct)}
        unit="%"
        bar={stats.utilizationPct}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  trend,
  bar,
  accent,
  warm,
}: {
  label: string;
  value: string;
  unit: string;
  trend?: string;
  bar?: number;
  accent?: boolean;
  warm?: boolean;
}) {
  const shellClass = accent
    ? 'border-transparent text-white'
    : warm
      ? 'border-sand-deep/50 text-ink'
      : 'border-mint-edge bg-white text-ink';
  const shellStyle = accent
    ? { backgroundImage: 'linear-gradient(135deg, #0F766E, #0B3B36)' }
    : warm
      ? { backgroundImage: 'linear-gradient(135deg, #FCE7C8, #FBF1DF)' }
      : undefined;
  const labelClass = accent ? 'text-white/75' : 'text-ink-soft';
  const valueClass = accent ? 'text-white' : 'text-ink';
  const unitClass = accent ? 'text-white/70' : 'text-ink-soft';
  const trendClass = accent
    ? 'text-white/85'
    : warm
      ? 'text-[#8a5b1a]'
      : 'text-primary-deep';

  return (
    <div className={`relative overflow-hidden rounded-[18px] border px-5 py-4 ${shellClass}`} style={shellStyle}>
      <div className={`text-[10px] font-bold uppercase tracking-[0.1em] ${labelClass}`}>{label}</div>
      <div className={`mt-2 flex items-baseline gap-1.5 text-[30px] font-extrabold leading-none tracking-tight ${valueClass}`}>
        {value}
        <span className={`text-[13px] font-semibold ${unitClass}`}>{unit}</span>
      </div>
      {trend && <div className={`mt-1.5 text-[11px] font-semibold ${trendClass}`}>{trend}</div>}
      {typeof bar === 'number' && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-mint">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(0, Math.min(100, bar))}%`,
              backgroundImage: 'linear-gradient(90deg, #14B8A6, #F5C77E)',
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Toolbar ─────────────────────────────────────────────────────────────

function Toolbar({ value, onChange }: { value: string; onChange: (d: string) => void }) {
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
    <section className="flex flex-wrap items-center gap-4 rounded-[20px] border border-mint-edge bg-white px-4.5 py-3.5 shadow-sm shadow-mint-edge/40" style={{ padding: '14px 18px' }}>
      <span className="px-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
        Date
      </span>
      <label className="flex items-center gap-2.5 rounded-[10px] border border-mint-edge bg-mint px-3.5 py-2 text-sm font-semibold text-ink">
        <CalendarIcon />
        <input
          type="date"
          value={value}
          min={today}
          onChange={(e) => onChange(e.target.value)}
          className="w-[120px] bg-transparent text-sm font-semibold text-ink outline-none"
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {shortcuts.map((s) => {
          const active = value === s.iso;
          return (
            <button
              key={s.iso}
              onClick={() => onChange(s.iso)}
              className={[
                'rounded-[10px] border px-3.5 py-2 text-[13px] font-semibold transition',
                active
                  ? 'border-transparent bg-gradient-to-br from-primary to-primary-deep text-white shadow-md shadow-primary-deep/30'
                  : 'border-mint-edge bg-white text-ink hover:border-mint-edge hover:bg-mint',
              ].join(' ')}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Legend ──────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 px-1 text-xs text-ink-soft">
      <LegendItem className="border border-dashed border-mint-edge bg-white" label="Open · tap to fill" />
      <LegendItem
        className="border border-coral/40 bg-coral-soft"
        label="Booked (from app)"
      />
      <LegendItem
        className="border border-primary bg-mint"
        label="Walk-in (yours)"
      />
      <LegendItem
        className="border-transparent bg-ink/5"
        label="Past / closed"
      />
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`inline-block h-3.5 w-3.5 rounded ${className}`} />
      {label}
    </span>
  );
}

// ─── Schedule ────────────────────────────────────────────────────────────

function Schedule({
  availability,
  onPick,
}: {
  availability: AvailabilityResponse;
  onPick: (key: SlotKey) => void;
}) {
  const { date, openingHour, closingHour, intervalMin, bays, bookings } = availability;

  const slots = useMemo(
    () => buildSlots(date, openingHour, closingHour, intervalMin),
    [date, openingHour, closingHour, intervalMin],
  );

  // Index bookings by bayId for fast lookup. Each booking spans potentially
  // multiple 30-min slots; we mark every covered cell as booked + remember
  // which booking is the cell's anchor (for tooltip text).
  const byBay = useMemo(() => indexBookings(bookings, bays), [bookings, bays]);

  // Number walk-ins in the order they were created today (by slotStart) so
  // the slot pill can show "Walk-in #03" like in the design.
  const walkInNumberById = useMemo(() => numberWalkIns(bookings), [bookings]);

  // Group slots into part-of-day buckets so we can label each band.
  const slotGroups = useMemo(() => groupSlotsByPeriod(slots), [slots]);

  // Per-period stats for the period band sub-label.
  const periodStats = useMemo(
    () => computePeriodStats(slotGroups, byBay, bays),
    [slotGroups, byBay, bays],
  );

  const now = new Date();
  const slotsPerBay = Math.floor(((closingHour - openingHour) * 60) / intervalMin);

  // Customer card popover state. Hover positions a small floating preview
  // anchored to the pill the cursor is on; click opens a centered modal
  // with the same content. Both states are independent — clicking a pill
  // clears the hover so the modal doesn't get a stale ghost behind it.
  const [hover, setHover] = useState<{
    booking: AvailabilityBooking;
    rect: DOMRect;
  } | null>(null);
  const [pinned, setPinned] = useState<AvailabilityBooking | null>(null);

  if (bays.length === 0) {
    return (
      <div className="rounded-2xl border border-mint-edge bg-white p-5 text-sm text-ink-soft shadow-sm shadow-mint-edge/40">
        No bays configured yet. Add a bay on the <strong>Bay board</strong> first.
      </div>
    );
  }

  // CSS-grid template columns: a fixed 110px "Time" column and one fluid
  // column per bay. Built as inline style because Tailwind can't generate
  // an arbitrary repeat() at runtime.
  const cols = { gridTemplateColumns: `110px repeat(${bays.length}, minmax(0, 1fr))` };

  return (
    <div className="overflow-hidden rounded-3xl border border-mint-edge bg-white shadow-sm shadow-mint-edge/40">
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 grid border-b border-mint-edge px-4.5"
        style={{
          ...cols,
          backgroundImage: 'linear-gradient(180deg, #FFFFFF, #E6F7F4 200%)',
          padding: '16px 18px',
        }}
      >
        <div className="self-center text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
          Time
        </div>
        {bays.map((bay) => (
          <BayHeader key={bay.id} bay={bay} slotCount={slotsPerBay} />
        ))}
      </div>

      {slotGroups.map(({ period, slots: groupSlots }) => (
        <div key={period}>
          <PeriodBand period={period} stats={periodStats[period]} cols={cols} />
          {groupSlots.map((slot) => (
            <div
              key={slot.iso}
              className="grid items-stretch border-b border-mint-edge/60 last:border-b-0"
              style={{ ...cols, padding: '0 18px' }}
            >
              <div className="self-center py-3.5 text-[13px] font-bold tabular-nums text-ink-soft">
                {slot.label}
              </div>
              {bays.map((bay) => {
                const booking =
                  byBay
                    .get(bay.id)
                    ?.find((b) => b.slotStart <= slot.iso && b.slotEnd > slot.iso) ?? null;
                return (
                  <Cell
                    key={bay.id + slot.iso}
                    bay={bay}
                    slotIso={slot.iso}
                    booking={booking}
                    isPast={new Date(slot.iso) < now}
                    walkInNumber={booking ? walkInNumberById.get(booking.id) : undefined}
                    isAnchorRow={!booking || booking.slotStart === slot.iso}
                    onPick={onPick}
                    onHover={(b, rect) =>
                      b && rect ? setHover({ booking: b, rect }) : setHover(null)
                    }
                    onPin={(b) => {
                      setPinned(b);
                      setHover(null);
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      ))}

      {/* Hover preview — fixed-position floating card anchored to the
          right edge of whatever pill the cursor is currently over. Hidden
          while a modal is pinned so they don't visually fight. */}
      {hover && !pinned && <HoverCustomerCard booking={hover.booking} rect={hover.rect} />}

      {/* Click-to-pin modal — centered overlay with backdrop click-to-close.
          Survives mouse-leave so the staff can read it carefully. */}
      {pinned && <CustomerModal booking={pinned} onClose={() => setPinned(null)} />}
    </div>
  );
}

function BayHeader({ bay, slotCount }: { bay: AvailabilityBay; slotCount: number }) {
  const isSuv = bay.bayType?.toLowerCase() === 'suv';
  const tagClass = isSuv
    ? 'bg-coral-soft text-[#a83d20]'
    : 'bg-mint text-primary-deep';
  return (
    <div className="flex flex-col gap-1 pr-4">
      <div className="flex items-center gap-2 text-[13px] font-extrabold text-ink">
        {bay.name}
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-[2px] text-[9px] font-bold uppercase tracking-[0.06em] ${tagClass}`}
        >
          {bay.bayType ?? 'Bay'}
        </span>
      </div>
      <div className="text-[11px] font-medium text-ink-soft">
        {bay.status === 'closed' ? 'Closed' : `${slotCount} slots`}
      </div>
    </div>
  );
}

function PeriodBand({
  period,
  stats,
  cols,
}: {
  period: SlotPeriod;
  stats: PeriodStats;
  cols: CSSProperties;
}) {
  const dotColor =
    period === 'Morning'
      ? '#14B8A6'
      : period === 'Afternoon'
        ? '#F5C77E'
        : '#FF8B6B';

  return (
    <div
      className="grid items-center border-y border-mint-edge px-4.5"
      style={{
        ...cols,
        backgroundImage: 'linear-gradient(90deg, #E6F7F4 0%, #DBF5F0 100%)',
        padding: '8px 18px',
      }}
    >
      <div
        className="flex items-center gap-2.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary-deep"
        style={{ gridColumn: '1 / -1' }}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />
        {period}
        <span className="ml-auto text-[11px] font-semibold normal-case tracking-normal text-ink-soft">
          {formatPeriodStats(stats)}
        </span>
      </div>
    </div>
  );
}

function Cell({
  bay,
  slotIso,
  booking,
  isPast,
  walkInNumber,
  isAnchorRow,
  onPick,
  onHover,
  onPin,
}: {
  bay: AvailabilityBay;
  slotIso: string;
  booking: AvailabilityBooking | null;
  isPast: boolean;
  walkInNumber: number | undefined;
  isAnchorRow: boolean;
  onPick: (key: SlotKey) => void;
  onHover: (booking: AvailabilityBooking | null, rect: DOMRect | null) => void;
  onPin: (booking: AvailabilityBooking) => void;
}) {
  // Shared mouse handlers for booked/walk-in pills — set/clear hover with
  // the pill's bounding rect (so the floating preview can anchor itself),
  // and pin on click. cursor:pointer hints at the click-to-detail.
  const pillHandlers = booking
    ? {
        onMouseEnter: (e: ReactMouseEvent<HTMLDivElement>) =>
          onHover(booking, e.currentTarget.getBoundingClientRect()),
        onMouseLeave: () => onHover(null, null),
        onClick: () => onPin(booking),
        style: { cursor: 'pointer' as const },
      }
    : {};

  // Booked / walk-in cell — only render the rich pill on the anchor row
  // (where the booking starts), so multi-slot bookings don't repeat their
  // contents on every covered row.
  if (booking) {
    if (!isAnchorRow) {
      return <div className="flex items-stretch px-2 py-2" />;
    }
    if (booking.isWalkIn) {
      return (
        <div className="flex items-stretch px-2 py-2">
          <div
            {...pillHandlers}
            className="flex flex-1 items-center gap-2.5 rounded-[10px] border border-primary bg-gradient-to-br from-mint to-mint-2 px-3 py-2 text-left text-xs font-semibold text-ink min-h-[50px] transition hover:shadow-md hover:shadow-primary-deep/20"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-deep text-white">
              <WalkerIcon />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-extrabold text-ink">
                Walk-in #{walkInNumber !== undefined ? String(walkInNumber).padStart(2, '0') : '–'}
              </span>
              <span className="truncate text-[10px] font-medium text-primary-deep">
                {formatBookingSub(booking)}
              </span>
            </div>
            {booking.status === 'in_progress' && <NowPulse />}
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-stretch px-2 py-2">
        <div
          {...pillHandlers}
          className="flex flex-1 items-center gap-2.5 rounded-[10px] border border-coral/45 bg-coral-soft px-3 py-2 text-left text-xs font-semibold text-ink min-h-[50px] transition hover:shadow-md hover:shadow-coral/30"
        >
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-coral/25 text-[#a83d20]">
            <PersonIcon />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-extrabold text-ink">
              {booking.customerName ?? 'Booked'}
            </span>
            <span className="truncate text-[10px] font-medium text-[#8a3f25]">
              {formatBookingSub(booking)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (isPast || bay.status === 'closed') {
    return (
      <div className="flex items-stretch px-2 py-2">
        <div className="flex flex-1 items-center gap-3 rounded-[10px] bg-ink/[0.04] px-3 py-2 text-[12px] font-medium text-ink-soft opacity-65 min-h-[50px]">
          {bay.status === 'closed' ? 'Closed' : 'No activity'}
          <span className="ml-2 flex-1 border-t border-ink/14" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-stretch px-2 py-2">
      <button
        onClick={() => onPick({ bayId: bay.id, startsAt: slotIso })}
        className="group flex flex-1 items-center gap-2.5 rounded-[10px] border border-dashed border-mint-edge bg-transparent px-3 py-2 text-left text-xs font-semibold text-ink-soft transition hover:-translate-y-px hover:border-solid hover:border-primary hover:bg-mint hover:text-primary-deep hover:shadow-md hover:shadow-primary-deep/20 min-h-[50px]"
      >
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-mint text-primary-deep transition group-hover:rotate-90 group-hover:bg-white">
          <PlusIcon />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-bold text-ink">Open</span>
          <span className="text-[10px] font-medium text-ink-soft">Tap to fill</span>
        </div>
      </button>
    </div>
  );
}

// ─── Customer card (hover preview + click modal) ─────────────────────────

/**
 * Compact card body — used identically inside the floating hover preview
 * and the click-to-pin modal. Brand-styled to match the customer app's
 * receipt cards and the vendor admin's other primary surfaces: cream/mint
 * gradient header, aqua-gradient FMB avatar, sand chip for the type tag,
 * dashed hairline tear-line, primary-deep eyebrow labels.
 */
function CustomerCard({ booking }: { booking: AvailabilityBooking }) {
  const carBits = [booking.carColor, booking.carMake, prettyCarType(booking.carType)]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="overflow-hidden rounded-2xl border border-mint-edge bg-white shadow-2xl shadow-ink/20">
      {/* Warm header strip — cream → mint halo with FMB-aqua avatar */}
      <div
        className="relative px-5 pb-4 pt-5"
        style={{ backgroundImage: 'linear-gradient(135deg, #FFF7EC 0%, #E6F7F4 100%)' }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-white"
            style={{
              backgroundImage: 'linear-gradient(150deg, #14B8A6 0%, #0F766E 100%)',
              boxShadow: '0 8px 18px -6px rgba(15,118,110,0.45)',
            }}
          >
            {booking.isWalkIn ? <WalkerIcon /> : <PersonIcon />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-[17px] font-extrabold tracking-tight text-ink">
                {booking.customerName ?? (booking.isWalkIn ? 'Walk-in' : 'Booked customer')}
              </div>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={[
                  'rounded-md px-2 py-[3px] text-[9px] font-extrabold uppercase tracking-[0.1em]',
                  booking.isWalkIn
                    ? 'bg-mint text-primary-deep'
                    : 'bg-sand text-[#7a4d12]',
                ].join(' ')}
                style={
                  booking.isWalkIn
                    ? undefined
                    : { border: '1px solid rgba(245, 199, 126, 0.55)' }
                }
              >
                {booking.isWalkIn ? 'Walk-in' : 'App booking'}
              </span>
              <span className="truncate text-[12px] font-semibold text-ink-soft">
                {booking.customerPhone ?? (
                  <span className="italic opacity-60">No phone on file</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dashed tear-line — receipt vibe, same treatment as the customer
          app's booking-confirmed receipt card. */}
      <CardDashedHairline />

      {/* Detail rows — eyebrow-style primary-deep labels per the brand
          typography system. */}
      <div className="grid grid-cols-[78px_1fr] gap-x-3 gap-y-2.5 bg-white px-5 py-4 text-[12px]">
        {booking.carPlate && (
          <CardRow label="Plate">
            <span className="font-mono font-bold tracking-[0.1em] text-ink">
              {booking.carPlate}
            </span>
          </CardRow>
        )}
        {carBits && <CardRow label="Car">{carBits}</CardRow>}
        <CardRow label="Service">
          <span className="font-semibold text-ink">{booking.serviceName}</span>
        </CardRow>
        <CardRow label="Status">
          <span className="capitalize text-ink">{booking.status.replace(/_/g, ' ')}</span>
          <span
            className={[
              'ml-2 rounded px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-[0.06em]',
              booking.paymentMethod === 'paid'
                ? 'bg-mint text-primary-deep'
                : booking.paymentMethod === 'cash'
                  ? 'bg-sand text-[#7a4d12]'
                  : 'bg-coral-soft text-[#a83d20]',
            ].join(' ')}
          >
            {booking.paymentMethod}
          </span>
        </CardRow>
        {booking.invoiceNumber && (
          <CardRow label="Invoice">
            <span className="font-mono text-[11px] font-bold tracking-[0.06em] text-primary-deep">
              {booking.invoiceNumber}
            </span>
          </CardRow>
        )}
        {booking.totalAed > 0 && (
          <>
            <div className="col-span-2 my-0.5 h-px bg-ink/[0.06]" />
            <CardRow label="Total">
              <span className="text-[15px] font-extrabold tracking-tight text-ink">
                AED {booking.totalAed}
              </span>
              {booking.vatAed > 0 && (
                <span className="ml-1.5 text-[11px] font-medium text-ink-soft">
                  incl. AED {booking.vatAed} VAT
                </span>
              )}
            </CardRow>
          </>
        )}
      </div>
    </div>
  );
}

function CardRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className="self-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary-deep">
        {label}
      </div>
      <div className="self-center text-[12px] text-ink">{children}</div>
    </>
  );
}

/** Dashed hairline — pairs with the cream header to read as a receipt stub. */
function CardDashedHairline() {
  return (
    <div className="relative h-px">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to right, rgba(11,59,54,0.18) 0 4px, transparent 4px 9px)',
        }}
      />
    </div>
  );
}

function prettyCarType(carType: string | null): string | null {
  if (!carType) return null;
  return carType.charAt(0).toUpperCase() + carType.slice(1).toLowerCase();
}

/**
 * Floating preview anchored to a hovered pill. Uses position:fixed with
 * the pill's bounding rect so we escape the schedule card's overflow
 * clip. Pointer-events disabled so the card itself can't intercept the
 * mouseleave on the underlying pill.
 */
function HoverCustomerCard({ booking, rect }: { booking: AvailabilityBooking; rect: DOMRect }) {
  // Default position: 8px to the right of the pill's right edge, aligned
  // with the pill's top. If that would push the card off the viewport,
  // flip to the left side instead.
  const cardWidth = 280;
  const margin = 8;
  const willFitRight = rect.right + margin + cardWidth <= window.innerWidth;
  const left = willFitRight ? rect.right + margin : rect.left - margin - cardWidth;
  const top = Math.max(8, Math.min(rect.top, window.innerHeight - 220));

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{ top, left, width: cardWidth }}
    >
      <CustomerCard booking={booking} />
    </div>
  );
}

/**
 * Click-to-pin modal. Backdrop click + Esc close it. Wider than the hover
 * preview so the receipt-style table is easier to read.
 */
function CustomerModal({
  booking,
  onClose,
}: {
  booking: AvailabilityBooking;
  onClose: () => void;
}) {
  // Esc-to-close. useEffect because we attach a window-level listener.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <CustomerCard booking={booking} />
        <div className="mt-3 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-full border border-mint-edge bg-white px-5 py-2 text-[13px] font-semibold text-ink-soft transition hover:border-primary/40 hover:bg-mint hover:text-ink"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function NowPulse() {
  return (
    <span className="ml-auto flex flex-shrink-0 items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.04em] text-primary-deep">
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60" />
      </span>
      Now
    </span>
  );
}

// ─── Inline icons ────────────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-primary-deep">
      <rect x="2" y="3" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 6h10M5 1.5v3M9 1.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <path d="M2 9.5c0-2 1.5-2.5 5-2.5s5 .5 5 2.5V12H2z" fill="currentColor" />
      <circle cx="7" cy="4" r="2" fill="currentColor" />
    </svg>
  );
}

function WalkerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="3" r="1.6" stroke="white" strokeWidth="1.3" />
      <path
        d="M7 4.5v3m-2 5l2-4 2 4M4 6l3-.8 3 .8"
        stroke="white"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
    // `phone` state now holds only the local digits after +971; concat
    // before validating + sending so the backend still receives E.164.
    if (phone && (phone.length < 7 || phone.length > 12)) {
      return setError('UAE phone is 7–12 digits after +971 (e.g. 501234567).');
    }
    const fullPhone = phone ? `+971${phone}` : undefined;
    create.mutate({
      bayId: slot.bayId,
      serviceId,
      slotStart: slot.startsAt,
      walkInName: name.trim() || undefined,
      walkInPhone: fullPhone,
    });
  }

  const selected = services.find((s) => s.id === serviceId);
  const slotTime = new Date(slot.startsAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
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
            <div className="flex items-stretch">
              {/* +971 is fixed; vendors always serve UAE numbers. The input
                  only captures the local digits and the country code is
                  reattached before submit. */}
              <span className="flex items-center rounded-l-lg border border-r-0 border-mint-edge bg-mint px-3 text-sm font-semibold text-primary-deep">
                +971
              </span>
              <input
                className="input flex-1 rounded-l-none"
                value={phone}
                onChange={(e) => {
                  // Strip everything that isn't a digit, drop a leading 0
                  // (UAE locals often type "050…" out of habit), and cap at
                  // 12 digits so paste of a full number doesn't overflow.
                  const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                  setPhone(digits.slice(0, 12));
                }}
                placeholder="501234567"
                inputMode="tel"
                maxLength={12}
              />
            </div>
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
      label: cursor.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    });
  }
  return slots;
}

type SlotPeriod = 'Morning' | 'Afternoon' | 'Evening';

/**
 * Split a flat slot list into chunks by part-of-day. Boundaries are based
 * on the slot's UAE wall-clock hour: < 12 → Morning, 12–16 → Afternoon,
 * ≥ 17 → Evening. Empty periods are dropped so the grid never renders a
 * lonely header with no rows under it.
 */
function groupSlotsByPeriod(
  slots: { iso: string; endIso: string; label: string }[],
): { period: SlotPeriod; slots: typeof slots }[] {
  const groups: { period: SlotPeriod; slots: typeof slots }[] = [];
  for (const slot of slots) {
    const hour = uaeHour(slot.iso);
    const period: SlotPeriod = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
    const last = groups[groups.length - 1];
    if (!last || last.period !== period) {
      groups.push({ period, slots: [slot] });
    } else {
      last.slots.push(slot);
    }
  }
  return groups;
}

function uaeHour(iso: string): number {
  // Intl gives us the wall-clock hour in UAE regardless of the browser's
  // own timezone — simpler than hand-rolling the offset.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
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

function numberWalkIns(bookings: AvailabilityBooking[]): Map<string, number> {
  const walkIns = bookings
    .filter((b) => b.isWalkIn)
    .slice()
    .sort((a, b) => a.slotStart.localeCompare(b.slotStart));
  const map = new Map<string, number>();
  walkIns.forEach((b, i) => map.set(b.id, i + 1));
  return map;
}

interface ScheduleStats {
  totalCells: number;
  bookedCells: number;
  openCells: number;
  appBookedCount: number;
  walkInCount: number;
  utilizationPct: number;
  nextFreeLabel: string | null;
  lastWalkInLabel: string | null;
}

function computeStats(a: AvailabilityResponse): ScheduleStats {
  const slotsPerBay = Math.max(0, Math.floor(((a.closingHour - a.openingHour) * 60) / a.intervalMin));
  const totalCells = slotsPerBay * a.bays.length;

  const intervalMs = a.intervalMin * 60_000;
  let bookedCells = 0;
  for (const b of a.bookings) {
    const span = (Date.parse(b.slotEnd) - Date.parse(b.slotStart)) / intervalMs;
    bookedCells += Math.max(1, Math.round(span));
  }

  const appBookedCount = a.bookings.filter((b) => !b.isWalkIn).length;
  const walkInCount = a.bookings.filter((b) => b.isWalkIn).length;

  const now = Date.now();
  const futureSlots = buildSlots(a.date, a.openingHour, a.closingHour, a.intervalMin).filter(
    (s) => Date.parse(s.iso) >= now,
  );
  const byBay = indexBookings(a.bookings, a.bays);
  let nextFreeLabel: string | null = null;
  outer: for (const s of futureSlots) {
    for (const bay of a.bays) {
      if (bay.status === 'closed') continue;
      const occupied = byBay.get(bay.id)?.some((b) => b.slotStart <= s.iso && b.slotEnd > s.iso);
      if (!occupied) {
        nextFreeLabel = `${s.label}, ${bay.name}`;
        break outer;
      }
    }
  }

  const lastWalkIn = a.bookings
    .filter((b) => b.isWalkIn)
    .sort((x, y) => y.slotStart.localeCompare(x.slotStart))[0];
  const lastWalkInLabel = lastWalkIn
    ? `${new Date(lastWalkIn.slotStart).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })} · ${a.bays.find((bb) => bb.id === lastWalkIn.bayId)?.name ?? 'Bay'}`
    : null;

  return {
    totalCells,
    bookedCells,
    openCells: Math.max(0, totalCells - bookedCells),
    appBookedCount,
    walkInCount,
    utilizationPct: totalCells === 0 ? 0 : Math.round((bookedCells / totalCells) * 100),
    nextFreeLabel,
    lastWalkInLabel,
  };
}

interface PeriodStats {
  walkIns: number;
  booked: number;
  past: number;
  freeNow: boolean;
}

function computePeriodStats(
  groups: { period: SlotPeriod; slots: { iso: string; endIso: string }[] }[],
  byBay: Map<string, AvailabilityBooking[]>,
  bays: AvailabilityBay[],
): Record<SlotPeriod, PeriodStats> {
  const now = Date.now();
  const empty: PeriodStats = { walkIns: 0, booked: 0, past: 0, freeNow: false };
  const out: Record<SlotPeriod, PeriodStats> = {
    Morning: { ...empty },
    Afternoon: { ...empty },
    Evening: { ...empty },
  };

  for (const g of groups) {
    let hasFreeFuture = false;
    for (const s of g.slots) {
      const isPast = Date.parse(s.iso) < now;
      for (const bay of bays) {
        const booking = byBay.get(bay.id)?.find((b) => b.slotStart <= s.iso && b.slotEnd > s.iso);
        if (booking) {
          // Only count the anchor slot of each booking to avoid double-counting.
          if (booking.slotStart === s.iso) {
            if (booking.isWalkIn) out[g.period].walkIns += 1;
            else out[g.period].booked += 1;
          }
        } else if (isPast || bay.status === 'closed') {
          out[g.period].past += 1;
        } else {
          hasFreeFuture = true;
        }
      }
    }
    out[g.period].freeNow = hasFreeFuture;
  }

  return out;
}

function formatBookingSub(b: AvailabilityBooking): string {
  // Slot pill subtitle: "Service · payment · status". The status word is
  // dropped when it's the boring default ('confirmed'/'alert_scheduled')
  // because those are the most common and just add visual noise.
  const parts: string[] = [b.serviceName];
  parts.push(b.paymentMethod);
  if (b.status !== 'confirmed' && b.status !== 'alert_scheduled') {
    parts.push(b.status.replace(/_/g, ' '));
  }
  return parts.join(' · ');
}

function formatPeriodStats(s: PeriodStats): string {
  if (!s) return '';
  const parts: string[] = [];
  if (s.walkIns) parts.push(`${s.walkIns} walk-in${s.walkIns === 1 ? '' : 's'}`);
  if (s.booked) parts.push(`${s.booked} booked`);
  if (s.past) parts.push(`${s.past} past`);
  if (parts.length === 0) return s.freeNow ? 'All open' : 'Nothing scheduled';
  return parts.join(' · ');
}

function todayUaeIso(): string {
  // Format the current instant as YYYY-MM-DD in UAE wall-clock. Intl handles
  // the timezone offset correctly regardless of where the browser sits.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftIso(iso: string, days: number): string {
  // Plain calendar arithmetic on the YYYY-MM-DD parts — no timezone math
  // needed for a whole-day shift, and UAE doesn't observe DST.
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
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
