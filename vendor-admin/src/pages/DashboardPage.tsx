// Vendor dashboard — analytics on completed bookings.
//
// Pulls /admin/dashboard which returns three blocks:
//   • summary KPIs (total washes / revenue / time / averages)
//   • per-service breakdown (count, revenue, durations)
//   • daily time series for the revenue chart
//
// Date range is controlled by a small chip row (Today / 7d / 30d / 90d).
// Custom range can be added later — the API already accepts `from` / `to`.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../api/admin';

type Range = 'today' | '7d' | '30d' | '90d';

const RANGES: { value: Range; label: string; days: number }[] = [
  { value: 'today', label: 'Today', days: 1 },
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
];

export default function DashboardPage() {
  const [range, setRange] = useState<Range>('30d');

  const dateParams = useMemo(() => {
    const days = RANGES.find((r) => r.value === range)?.days ?? 30;
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [range]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', range],
    queryFn: () => getDashboard(dateParams),
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-eyebrow mb-1">Analytics</div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Total washes, revenue, and time spent — calculated from completed bookings only.
          </p>
        </div>
        <RangeChips value={range} onChange={setRange} />
      </header>

      {error && (
        <div className="card border-coral bg-coral-soft text-sm text-coral">
          Couldn't load analytics. Try refreshing.
        </div>
      )}

      {isLoading && !data && <KpiSkeleton />}

      {data && (
        <>
          <KpiRow summary={data.summary} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <RevenueChart points={data.byDay} />
            <ServiceBreakdown rows={data.byService} />
          </div>
        </>
      )}
    </div>
  );
}

// ── KPI cards ─────────────────────────────────────────────────────────────

function KpiRow({ summary }: { summary: import('../api/admin').DashboardSummary }) {
  const totalHours = Math.floor(summary.totalDurationMin / 60);
  const totalMinsRem = summary.totalDurationMin % 60;
  const totalTimeLabel =
    totalHours > 0 ? `${totalHours}h ${totalMinsRem}m` : `${summary.totalDurationMin} min`;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <KpiCard
        label="Total washes"
        value={summary.totalBookings.toLocaleString()}
        sub="completed bookings"
        accent="primary"
      />
      <KpiCard
        label="Revenue"
        value={`AED ${summary.totalRevenueAed.toLocaleString()}`}
        sub={`avg AED ${summary.avgRevenuePerBookingAed.toLocaleString()} / wash`}
        accent="primary"
      />
      <KpiCard
        label="Time spent"
        value={totalTimeLabel}
        sub={`avg ${summary.avgDurationMin} min / wash`}
        accent="sand"
      />
      <KpiCard
        label="Avg revenue / hour"
        value={
          summary.totalDurationMin > 0
            ? `AED ${Math.round((summary.totalRevenueAed / summary.totalDurationMin) * 60).toLocaleString()}`
            : 'AED —'
        }
        sub="effective hourly rate"
        accent="primary"
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: 'primary' | 'sand';
}) {
  const bg =
    accent === 'sand'
      ? 'linear-gradient(135deg, #FCE7C8 0%, #FFE3D9 100%)'
      : 'linear-gradient(135deg, #CCFBF1 0%, #E6F7F4 100%)';
  return (
    <div className="card flex flex-col gap-1" style={{ backgroundImage: bg }}>
      <div className="label-eyebrow">{label}</div>
      <div className="text-2xl font-extrabold tracking-tight text-ink">{value}</div>
      {sub && <div className="text-xs text-ink-soft">{sub}</div>}
    </div>
  );
}

// ── Revenue chart (sparklines, one bar per day) ──────────────────────────

function RevenueChart({ points }: { points: import('../api/admin').DashboardDailyPoint[] }) {
  const maxRevenue = Math.max(1, ...points.map((p) => p.revenueAed));
  const isEmpty = points.length === 0 || points.every((p) => p.revenueAed === 0);

  return (
    <section className="card lg:col-span-2 flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="label-eyebrow">Revenue per day</div>
          <h2 className="text-lg font-bold text-ink">Daily breakdown</h2>
        </div>
        <div className="text-xs text-ink-soft">
          Peak: AED {maxRevenue.toLocaleString()}
        </div>
      </div>

      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-mint-edge bg-mint/30 p-8 text-center text-sm text-ink-soft">
          No completed washes in this period yet.
        </div>
      ) : (
        <div className="relative flex h-40 items-end gap-1">
          {points.map((p) => {
            // Bars are sized in pixels off the parent's 160px (h-40) so each
            // bar's height computes off a definite track — using % off a flex
            // column's intrinsic height collapses to 0 (which is what was
            // making the chart appear empty).
            const heightPx = Math.max(3, Math.round((p.revenueAed / maxRevenue) * 160));
            return (
              <div
                key={p.date}
                className="group relative flex h-full flex-1 flex-col items-center justify-end"
                title={`${p.date} · AED ${p.revenueAed} · ${p.count} washes`}
              >
                <div
                  className="w-full rounded-t-sm transition-opacity group-hover:opacity-80"
                  style={{ height: `${heightPx}px`, backgroundColor: '#0F766E' }}
                />
                {/* Tooltip on hover */}
                <div className="pointer-events-none absolute -top-10 hidden whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[10px] font-medium text-white group-hover:block">
                  {p.date} · AED {p.revenueAed}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Service breakdown table ──────────────────────────────────────────────

function ServiceBreakdown({
  rows,
}: {
  rows: import('../api/admin').DashboardServiceBreakdown[];
}) {
  return (
    <section className="card flex flex-col gap-3">
      <div>
        <div className="label-eyebrow">By service type</div>
        <h2 className="text-lg font-bold text-ink">Breakdown</h2>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-mint-edge bg-mint/30 p-6 text-center text-sm text-ink-soft">
          No completed washes to break down yet.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-mint-edge">
          {rows
            .slice()
            .sort((a, b) => b.revenueAed - a.revenueAed)
            .map((row) => (
              <li key={row.serviceId} className="py-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-ink">{row.name}</span>
                  <span className="text-sm font-bold text-primary-deep">
                    AED {row.revenueAed.toLocaleString()}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-ink-soft">
                  {row.count} {row.count === 1 ? 'wash' : 'washes'} · {row.durationMinPerWash} min each ·{' '}
                  {row.totalDurationMin} min total
                </div>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

// ── Range chips (Today / 7d / 30d / 90d) ─────────────────────────────────

function RangeChips({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex gap-1 rounded-full border border-mint-edge bg-white p-1">
      {RANGES.map((r) => {
        const active = value === r.value;
        return (
          <button
            key={r.value}
            onClick={() => onChange(r.value)}
            className={[
              'rounded-full px-3 py-1.5 text-xs font-medium transition',
              active ? 'bg-primary-deep text-white' : 'text-ink-soft hover:text-ink',
            ].join(' ')}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="h-3 w-20 rounded bg-mint-edge" />
          <div className="mt-2 h-7 w-24 rounded bg-mint-edge" />
          <div className="mt-2 h-3 w-32 rounded bg-mint-edge" />
        </div>
      ))}
    </div>
  );
}
