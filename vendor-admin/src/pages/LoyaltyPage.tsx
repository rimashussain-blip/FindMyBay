// Vendor admin → Loyalty.
//
// Tier tabs (All / Bronze / Silver / Gold / Platinum), customer roster
// table with tier + visits + spend + last-visit. Click a row to open
// the detail modal with recent bookings + next-tier progress.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getLoyaltyDetail,
  listLoyalty,
  type LoyaltyDetail,
  type LoyaltyRosterItem,
  type LoyaltyTier,
} from '../api/loyalty';
import { TierBadge, tierLabel, visitCounter } from '../components/TierBadge';

type TabValue = 'all' | LoyaltyTier;

export default function LoyaltyPage() {
  const [tab, setTab] = useState<TabValue>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['loyalty', tab, q, page],
    queryFn: () =>
      listLoyalty({
        tier: tab === 'all' ? undefined : tab,
        q: q || undefined,
        page,
        pageSize: 30,
      }),
  });

  const counts = data?.counts ?? { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  const allCount = counts.bronze + counts.silver + counts.gold + counts.platinum;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="label-eyebrow mb-1">Customers</div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Loyalty</h1>
          <p className="mt-1 text-sm text-ink-soft max-w-[620px]">
            Customers who've completed at least one wash with you. Tiers reflect
            their platform-wide history, but you also see how many visits
            they've had with you specifically.
          </p>
        </div>
        <input
          className="input max-w-xs"
          placeholder="Search name, phone, email, plate…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
      </header>

      {/* Tier tabs with counts */}
      <div className="flex items-center gap-1 rounded-2xl border border-mint-edge bg-white p-1 w-fit flex-wrap">
        <TabButton label="All" count={allCount} on={tab === 'all'} onClick={() => { setTab('all'); setPage(1); }} />
        {(['platinum', 'gold', 'silver', 'bronze'] as const).map((t) => (
          <TabButton
            key={t}
            label={tierLabel(t)}
            count={counts[t]}
            on={tab === t}
            onClick={() => { setTab(t); setPage(1); }}
            tier={t}
          />
        ))}
      </div>

      {isLoading && <Skeleton />}
      {error && (
        <div className="rounded-xl bg-coral-soft text-coral p-4 text-sm">
          Couldn't load loyalty data.
        </div>
      )}

      {data && data.items.length === 0 && !isLoading && (
        <div className="rounded-2xl border border-dashed border-mint-edge bg-white/60 p-10 text-center">
          <div className="text-ink font-bold text-lg">No customers in this tier yet</div>
          <div className="mt-1.5 text-sm text-ink-soft max-w-[420px] mx-auto">
            Tiers fill in as customers complete bookings with you. New customers
            start at Bronze; 3 washes promote them to Silver.
          </div>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="rounded-2xl border border-mint-edge bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-mint/40 text-left text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3 text-right">Visits here</th>
                <th className="px-4 py-3 text-right">Platform total</th>
                <th className="px-4 py-3 text-right">Lifetime spend</th>
                <th className="px-4 py-3">Last visit</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mint-edge">
              {data.items.map((c) => (
                <CustomerRow key={c.id} c={c} onOpen={() => setOpenId(c.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > data.pageSize && (
        <Pagination
          page={page}
          totalPages={Math.ceil(data.total / data.pageSize)}
          onChange={setPage}
        />
      )}

      {openId && <DetailModal customerId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────

function CustomerRow({
  c,
  onOpen,
}: {
  c: LoyaltyRosterItem;
  onOpen: () => void;
}) {
  return (
    <tr className="hover:bg-mint/20 cursor-pointer" onClick={onOpen}>
      <td className="px-4 py-3">
        <div className="font-semibold text-ink">{c.name ?? '—'}</div>
        <div className="text-xs text-ink-soft">{c.phone ?? c.email ?? '—'}</div>
        {c.car.plate && (
          <div className="text-[11px] text-ink-soft mt-0.5 font-mono">{c.car.plate}</div>
        )}
      </td>
      <td className="px-4 py-3">
        <TierBadge tier={c.tier} />
      </td>
      <td className="px-4 py-3 text-right font-semibold text-ink">{c.bookingsAtVendor}</td>
      <td className="px-4 py-3 text-right text-ink-soft">{c.lifetimeBookings}</td>
      <td className="px-4 py-3 text-right text-ink-soft">AED {c.lifetimeSpendAed.toLocaleString()}</td>
      <td className="px-4 py-3 text-ink-soft">{c.lastBookingAt ? formatRelative(c.lastBookingAt) : '—'}</td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="rounded-lg border border-mint-edge bg-white px-3 py-1.5 text-xs font-semibold text-primary-deep hover:bg-mint"
        >
          View
        </button>
      </td>
    </tr>
  );
}

// ── Detail modal ─────────────────────────────────────────────────────────

function DetailModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['loyalty-detail', customerId],
    queryFn: () => getLoyaltyDetail(customerId),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-mint-edge">
          <h3 className="text-lg font-bold text-ink">Customer profile</h3>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          {isLoading && <div className="text-sm text-ink-soft">Loading…</div>}
          {error && <div className="text-sm text-coral">Couldn't load this customer.</div>}
          {data && <DetailBody data={data} />}
        </div>
      </div>
    </div>
  );
}

function DetailBody({ data }: { data: LoyaltyDetail }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xl font-bold text-ink">{data.name ?? '—'}</div>
          <div className="text-xs text-ink-soft mt-0.5">
            {[data.phone, data.email].filter(Boolean).join(' · ') || '—'}
          </div>
          <div className="text-xs text-ink-soft mt-0.5">
            Member since{' '}
            {new Date(data.memberSince).toLocaleDateString('en-AE', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </div>
        </div>
        <div className="text-right">
          <TierBadge tier={data.loyalty.tier} />
          <div className="text-[10px] uppercase tracking-wider text-ink-soft mt-1.5">
            {visitCounter({
              lifetimeBookings: data.loyalty.lifetimeBookings,
              bookingsAtVendor: data.loyalty.bookingsAtVendor,
            })}
          </div>
        </div>
      </div>

      {/* Car (if known) */}
      {(data.car.make || data.car.plate) && (
        <div className="rounded-xl border border-mint-edge bg-mint/30 p-3 text-xs">
          <div className="label-eyebrow mb-1">Vehicle</div>
          <div className="text-sm font-semibold text-ink">
            {[data.car.color, data.car.make, data.car.type].filter(Boolean).join(' · ') || '—'}
          </div>
          {data.car.plate && (
            <div className="text-xs text-ink-soft mt-0.5 font-mono">{data.car.plate}</div>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Visits here" value={String(data.loyalty.bookingsAtVendor ?? 0)} />
        <Stat label="Platform total" value={String(data.loyalty.lifetimeBookings)} />
        <Stat label="Lifetime spend" value={`AED ${data.loyalty.lifetimeSpendAed.toLocaleString()}`} />
      </div>

      {/* Next tier nudge */}
      {data.nextTier.next ? (
        <div
          className="rounded-2xl border-[1.5px] border-primary/40 bg-white p-4"
          style={{ backgroundImage: 'linear-gradient(135deg, #E6F7F4, #FFFFFF)' }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-deep">
              Next tier
            </span>
            <TierBadge tier={data.nextTier.next} size="sm" />
          </div>
          <p className="text-sm text-ink">
            {data.nextTier.bookingsToGo && data.nextTier.bookingsToGo > 0 ? (
              <>
                {data.nextTier.bookingsToGo === 1
                  ? 'One more wash unlocks '
                  : `${data.nextTier.bookingsToGo} more washes unlock `}
                <span className="font-semibold capitalize">{data.nextTier.next}</span>.
              </>
            ) : data.nextTier.spendToGoAed && data.nextTier.spendToGoAed > 0 ? (
              <>
                Another AED {data.nextTier.spendToGoAed.toLocaleString()} spent unlocks{' '}
                <span className="font-semibold capitalize">{data.nextTier.next}</span>.
              </>
            ) : (
              <>
                One more wash unlocks{' '}
                <span className="font-semibold capitalize">{data.nextTier.next}</span>.
              </>
            )}
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl border-[1.5px] text-white p-4 text-sm font-semibold"
          style={{ backgroundImage: 'linear-gradient(135deg, #14B8A6, #0F766E)' }}
        >
          Platinum — top tier reached. Look after this one.
        </div>
      )}

      {/* Recent bookings */}
      <div>
        <h4 className="text-sm font-bold text-ink mb-2">Recent visits</h4>
        {data.recentBookings.length === 0 ? (
          <p className="text-xs text-ink-soft">No completed visits with you yet.</p>
        ) : (
          <ul className="divide-y divide-mint-edge rounded-xl border border-mint-edge overflow-hidden">
            {data.recentBookings.map((b) => (
              <li key={b.id} className="px-3 py-2 flex items-center gap-2 bg-white">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink">{b.serviceName}</div>
                  <div className="text-xs text-ink-soft">
                    {new Date(b.slotStart).toLocaleString('en-AE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {b.invoiceNumber && ` · ${b.invoiceNumber}`}
                  </div>
                </div>
                <span
                  className={[
                    'text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5',
                    b.status === 'completed'
                      ? 'bg-mint text-primary-deep'
                      : 'bg-mint-edge text-ink-soft',
                  ].join(' ')}
                >
                  {b.status}
                </span>
                <div className="text-sm font-semibold text-ink">AED {b.totalAed}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-mint-edge bg-white p-3 text-center">
      <div className="label-eyebrow mb-0.5">{label}</div>
      <div className="text-sm font-bold text-ink">{value}</div>
    </div>
  );
}

// ── Tab button ───────────────────────────────────────────────────────────

function TabButton({
  label,
  count,
  on,
  onClick,
  tier,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
  tier?: LoyaltyTier;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-xl px-4 py-2 text-sm font-semibold transition flex items-center gap-2 capitalize',
        on ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:text-ink',
      ].join(' ')}
    >
      {label}
      <span
        className={[
          'text-[10px] font-bold px-1.5 py-0.5 rounded',
          on ? 'bg-white/22 text-white' : 'bg-mint text-primary-deep',
        ].join(' ')}
      >
        {count}
      </span>
      {!on && tier && (
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={tierDotStyle(tier)} />
      )}
    </button>
  );
}

function tierDotStyle(tier: LoyaltyTier): React.CSSProperties {
  switch (tier) {
    case 'bronze':   return { background: '#7a4d12' };
    case 'silver':   return { background: '#CDEEE8' };
    case 'gold':     return { background: '#F5C77E' };
    case 'platinum': return { background: '#0F766E' };
  }
}

// ── Misc ─────────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 text-sm text-ink-soft">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="rounded-lg border border-mint-edge bg-white px-3 py-1.5 disabled:opacity-40"
      >
        Prev
      </button>
      <span>
        Page <span className="font-semibold text-ink">{page}</span> of {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-lg border border-mint-edge bg-white px-3 py-1.5 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="rounded-2xl border border-mint-edge bg-white p-6">
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-mint/40" />
        ))}
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)}y ago`;
}
