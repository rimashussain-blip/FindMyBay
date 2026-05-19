// Vendor admin → Promotions.
//
// Matches Batch A — Promotions (Find My Bay design handoff, A1 + A2):
// - A1: tabs (Active / Scheduled / Expired) + branded promo cards with
//   mint→sand gradient header, 1.5dp primary outline, type chip,
//   usage progress bar, revenue impact, edit + pause buttons.
// - A2: modal-based create flow with sections (Basics, Applicability,
//   Validity, Visibility, Terms). Live preview pane omitted from V1;
//   it's a nice-to-have we can add once the core CRUD ships.

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archivePromotion,
  createPromotion,
  listPromotions,
  pausePromotion,
  resumePromotion,
  updatePromotion,
  type CarType,
  type CreatePromotionBody,
  type Promotion,
  type PromotionStatus,
  type PromotionType,
} from '../api/promotions';
import { getMe } from '../api/admin';

type Tab = 'active' | 'scheduled' | 'expired';

export default function PromotionsPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [creating, setCreating] = useState(false);

  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['promotions', tab],
    queryFn: () => listPromotions(tab),
  });

  // Pull the vendor's services for the Applicability picker. Same /admin/me
  // endpoint that BrandPage and ServicesPage use — single cache hit.
  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe });
  const vendorServices = meQ.data?.vendor.services ?? [];

  const counts = data?.counts ?? { active: 0, scheduled: 0, expired: 0 };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="label-eyebrow mb-1">Marketing</div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Promotions</h1>
          <p className="mt-1 text-sm text-ink-soft max-w-[620px]">
            Create promo codes to reward customers and drive bookings. Active
            codes are applied at checkout.
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          + Create promotion
        </button>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-2xl border border-mint-edge bg-white p-1 w-fit">
        {(['active', 'scheduled', 'expired'] as const).map((t) => {
          const on = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'rounded-xl px-4 py-2 text-sm font-semibold transition flex items-center gap-2',
                on ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:text-ink',
              ].join(' ')}
            >
              {t[0].toUpperCase() + t.slice(1)}
              <span
                className={[
                  'text-[10px] font-bold px-1.5 py-0.5 rounded',
                  on ? 'bg-white/22 text-white' : 'bg-mint text-primary-deep',
                ].join(' ')}
              >
                {counts[t]}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[0, 1, 2].map((i) => (
            <PromoCardSkeleton key={i} />
          ))}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-coral-soft text-coral p-4 text-sm">
          Couldn't load promotions. Try refreshing.
        </div>
      )}
      {data && data.items.length === 0 && <PromoEmptyState onCreate={() => setCreating(true)} />}
      {data && data.items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {data.items.map((p) => (
            <PromoCard
              key={p.id}
              promo={p}
              onEdit={() => setEditing(p)}
              onPause={async () => {
                await pausePromotion(p.id);
                qc.invalidateQueries({ queryKey: ['promotions'] });
              }}
              onResume={async () => {
                await resumePromotion(p.id);
                qc.invalidateQueries({ queryKey: ['promotions'] });
              }}
              onArchive={async () => {
                if (!confirm(`Archive "${p.name}"? Existing redemptions stay.`)) return;
                await archivePromotion(p.id);
                qc.invalidateQueries({ queryKey: ['promotions'] });
              }}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <PromoFormDialog
          initial={editing ?? undefined}
          services={vendorServices}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            qc.invalidateQueries({ queryKey: ['promotions'] });
          }}
        />
      )}
    </div>
  );
}

// ─── PromoCard ───────────────────────────────────────────────────────────

function PromoCard({
  promo,
  onEdit,
  onPause,
  onResume,
  onArchive,
}: {
  promo: Promotion;
  onEdit: () => void;
  onPause: () => void;
  onResume: () => void;
  onArchive: () => void;
}) {
  const pct = promo.usageLimit > 0 ? Math.min(100, Math.round((promo.used / promo.usageLimit) * 100)) : 0;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(promo.endsAt).getTime() - Date.now()) / (24 * 3600 * 1000)),
  );
  const validityRange = `${formatMD(promo.startsAt)} – ${formatMD(promo.endsAt)}`;

  return (
    <div className="overflow-hidden rounded-2xl border-[1.5px] border-primary bg-white shadow-md shadow-ink/8">
      {/* Mint→sand header strip */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ backgroundImage: 'linear-gradient(90deg, #E6F7F4, #FCE7C8)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.05em] text-primary-deep">
            {promo.autoApplied ? '⚡ Auto-applied' : '🏷 Code required'}
          </span>
          <TypeChip type={promo.type} />
          <StatusChip status={promo.status} />
        </div>
        <span className="text-[10px] font-semibold text-ink-soft">{daysLeft}d left</span>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="text-base font-bold tracking-tight text-ink">{promo.name}</div>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] font-bold tracking-wider text-primary-deep bg-mint px-2 py-0.5 rounded">
                {promo.code}
              </span>
              <span className="text-[11px] text-ink-soft">
                {promoDescription(promo)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-2 text-[11px] text-ink-soft">{validityRange}</div>

        {/* Usage bar */}
        {promo.usageLimit > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-ink-soft">Usage</span>
              <span className="text-[10px] font-bold text-primary-deep">
                {promo.used} / {promo.usageLimit}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-mint overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  backgroundImage: 'linear-gradient(90deg, #14B8A6, #0F766E)',
                }}
              />
            </div>
          </div>
        )}

        {/* Revenue + actions */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-[11px] text-ink-soft">Discount given</span>
            <span className="font-bold text-primary-deep" style={{ fontFamily: 'DM Sans, system-ui', fontSize: 16 }}>
              AED {promo.amountOffAedTotal}
            </span>
          </div>
          <div className="flex gap-1.5">
            {promo.status !== 'archived' && (
              <button
                onClick={onEdit}
                className="h-8 px-3 rounded-lg border border-mint-edge bg-white text-[11px] font-semibold text-ink hover:bg-mint"
              >
                Edit
              </button>
            )}
            {promo.status === 'active' && (
              <button
                onClick={onPause}
                className="h-8 px-3 rounded-lg border border-mint-edge bg-white text-[11px] font-semibold text-ink-soft hover:bg-mint hover:text-ink"
              >
                Pause
              </button>
            )}
            {promo.status === 'paused' && (
              <button
                onClick={onResume}
                className="h-8 px-3 rounded-lg border border-primary/40 bg-mint text-[11px] font-semibold text-primary-deep hover:border-primary"
              >
                Resume
              </button>
            )}
            {promo.status !== 'archived' && (
              <button
                onClick={onArchive}
                className="h-8 px-3 rounded-lg border border-mint-edge bg-white text-[11px] font-semibold text-coral hover:bg-coral-soft"
              >
                Archive
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PromoCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-mint-edge bg-white">
      <div className="h-9 bg-mint animate-pulse" />
      <div className="p-4 flex flex-col gap-3">
        <div className="h-5 w-2/3 bg-mint-edge rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-mint-edge rounded animate-pulse" />
        <div className="h-1.5 bg-mint-edge rounded-full animate-pulse" />
        <div className="flex justify-between">
          <div className="h-5 w-32 bg-mint-edge rounded animate-pulse" />
          <div className="flex gap-1.5">
            <div className="h-8 w-14 bg-mint-edge rounded-lg animate-pulse" />
            <div className="h-8 w-14 bg-mint-edge rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PromoEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 py-16">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md"
        style={{ backgroundImage: 'linear-gradient(135deg, #E6F7F4, #FCE7C8)' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 12v10H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
        </svg>
      </div>
      <div className="text-lg font-bold text-ink">No promotions yet</div>
      <div className="text-sm text-ink-soft max-w-xs">
        Create a promotion to attract more bookings and reward your regulars.
      </div>
      <button onClick={onCreate} className="btn-primary mt-2">
        + Create promotion
      </button>
    </div>
  );
}

// ─── Chips ───────────────────────────────────────────────────────────────

function TypeChip({ type }: { type: PromotionType }) {
  const cfg: Record<PromotionType, { bg: string; color: string; label: string }> = {
    percent: { bg: '#FCE7C8', color: '#7A4D12', label: '% Off' },
    fixed: { bg: '#E6F7F4', color: '#0F766E', label: 'Fixed' },
    bundle: { bg: '#FFE3D9', color: '#FF8B6B', label: 'Bundle' },
  };
  const c = cfg[type];
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded"
      style={{ background: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}

function StatusChip({ status }: { status: PromotionStatus }) {
  if (status === 'active') return null;
  const cfg: Record<Exclude<PromotionStatus, 'active'>, { bg: string; color: string }> = {
    scheduled: { bg: '#E6F7F4', color: '#0F766E' },
    paused: { bg: '#FCE7C8', color: '#7A4D12' },
    expired: { bg: '#F3F4F6', color: '#6B7280' },
    archived: { bg: '#FFE3D9', color: '#a83d20' },
  };
  const c = cfg[status];
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
      style={{ background: c.bg, color: c.color }}
    >
      {status}
    </span>
  );
}

// ─── Create / Edit dialog ────────────────────────────────────────────────

interface ServiceLike {
  id: string;
  name: string;
  durationMin: number;
  priceAed: number;
}

function PromoFormDialog({
  initial,
  services,
  onClose,
  onSaved,
}: {
  initial?: Promotion;
  services: ServiceLike[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [type, setType] = useState<PromotionType>(initial?.type ?? 'percent');
  const [value, setValue] = useState(String(initial?.value ?? 10));
  const [applicableServiceIds, setApplicableServiceIds] = useState<string[]>(
    initial?.applicableServiceIds ?? [],
  );
  const [carTypes, setCarTypes] = useState<CarType[]>(
    initial?.applicableCarTypes ?? [],
  );
  const [minSpend, setMinSpend] = useState(String(initial?.minSpendAed ?? ''));
  const [startsAt, setStartsAt] = useState(
    initial?.startsAt ? toLocalDateInputValue(initial.startsAt) : todayLocal(),
  );
  const [endsAt, setEndsAt] = useState(
    initial?.endsAt ? toLocalDateInputValue(initial.endsAt) : nextMonthLocal(),
  );
  const [usageLimit, setUsageLimit] = useState(String(initial?.usageLimit ?? 100));
  const [perCustomerLimit, setPerCustomerLimit] = useState(
    String(initial?.perCustomerLimit ?? 1),
  );
  const [autoApplied, setAutoApplied] = useState(initial?.autoApplied ?? false);
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [terms, setTerms] = useState(initial?.terms ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const body: CreatePromotionBody = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type,
        value: Number(value),
        applicableServiceIds,
        applicableCarTypes: carTypes,
        minSpendAed: minSpend === '' ? null : Number(minSpend),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        usageLimit: Number(usageLimit) || 0,
        perCustomerLimit: Number(perCustomerLimit) || 0,
        autoApplied,
        featured,
        terms: terms.trim() || null,
      };
      if (initial) return updatePromotion(initial.id, body);
      return createPromotion(body);
    },
    onSuccess: onSaved,
    onError: (e: unknown) => setError(extractError(e)),
  });

  function submit() {
    setError(null);
    if (!name.trim()) return setError('Promotion name is required.');
    if (!/^[A-Z0-9_-]{3,20}$/.test(code.trim().toUpperCase())) {
      return setError('Promo code must be 3-20 uppercase letters, digits, _ or -');
    }
    if (Number.isNaN(Number(value)) || Number(value) <= 0) {
      return setError('Discount value must be a positive number.');
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      return setError('End date must be after the start date.');
    }
    save.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-cream rounded-3xl border-[1.5px] border-primary shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ backgroundImage: 'linear-gradient(90deg, #E6F7F4, #FCE7C8)' }}
        >
          <div>
            <div className="label-eyebrow">{editing ? 'Edit' : 'Create'} promotion</div>
            <h2 className="text-xl font-bold text-ink">{name || 'New promotion'}</h2>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-white border border-mint-edge text-ink-soft hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Basics */}
          <Section n={1} title="Basics">
            <Field label="Promotion name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer Splash 20% Off" />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Promo code">
                <div className="relative">
                  <input
                    className="input font-mono uppercase tracking-wider"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="AUTO20"
                  />
                  <button
                    type="button"
                    onClick={() => setCode(suggestCode(name))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary"
                  >
                    Auto-suggest
                  </button>
                </div>
              </Field>
              <Field label="Type">
                <div className="flex h-12 border-[1.5px] border-mint-edge rounded-xl overflow-hidden">
                  {(
                    [
                      ['percent', '% Off'],
                      ['fixed', 'Fixed AED'],
                      ['bundle', 'Bundle'],
                    ] as const
                  ).map(([id, lbl], i) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setType(id)}
                      className={[
                        'flex-1 text-xs font-semibold transition',
                        i < 2 ? 'border-r-[1.5px] border-mint-edge' : '',
                        type === id ? 'bg-primary text-white' : 'bg-white text-ink-soft hover:bg-mint',
                      ].join(' ')}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <Field label="Discount value">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  inputMode="numeric"
                  value={value}
                  onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ''))}
                  disabled={type === 'bundle'}
                />
                <div className="h-12 px-4 rounded-xl border-[1.5px] border-mint-edge bg-mint flex items-center text-sm font-bold text-primary-deep">
                  {type === 'percent' ? '%' : type === 'fixed' ? 'AED' : 'n/a'}
                </div>
              </div>
            </Field>
          </Section>

          {/* Applicability */}
          <Section n={2} title="Applicability">
            <Field label="Applicable services">
              <div className="flex flex-wrap gap-2">
                {services.length === 0 && (
                  <span className="text-xs text-ink-soft">
                    No services yet — visit the Services page to add some.
                  </span>
                )}
                {services.map((s) => {
                  const on = applicableServiceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setApplicableServiceIds((curr) =>
                          on ? curr.filter((x) => x !== s.id) : [...curr, s.id],
                        )
                      }
                      className={[
                        'px-3 py-1.5 rounded-full text-xs font-semibold border-[1.5px] transition',
                        on
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-ink border-mint-edge hover:border-primary/40',
                      ].join(' ')}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-ink-soft">
                Leave empty to apply to all services.
              </p>
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Vehicle types">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['', 'All'],
                      ['sedan', 'Sedan'],
                      ['hatchback', 'Hatchback'],
                      ['suv', 'SUV'],
                      ['pickup', 'Pickup'],
                      ['van', 'Van'],
                      ['coupe', 'Coupe'],
                      ['other', 'Other'],
                    ] as const
                  ).map(([id, lbl]) => {
                    const isAll = id === '';
                    const on = isAll
                      ? carTypes.length === 0
                      : carTypes.includes(id as CarType);
                    return (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => {
                          if (isAll) setCarTypes([]);
                          else
                            setCarTypes((curr) =>
                              on
                                ? curr.filter((x) => x !== id)
                                : [...curr, id as CarType],
                            );
                        }}
                        className={[
                          'px-3 py-2 rounded-lg text-xs font-semibold border-[1.5px] transition',
                          on
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-ink-soft border-mint-edge',
                        ].join(' ')}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Minimum spend (AED)">
                <div className="flex">
                  <div className="h-12 px-3 rounded-l-xl border-[1.5px] border-r-0 border-mint-edge bg-mint flex items-center text-xs font-bold text-primary-deep">
                    AED
                  </div>
                  <input
                    className="input flex-1 rounded-l-none"
                    inputMode="numeric"
                    value={minSpend}
                    onChange={(e) => setMinSpend(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="0"
                  />
                </div>
              </Field>
            </div>
          </Section>

          {/* Validity */}
          <Section n={3} title="Validity">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Start date">
                <input
                  type="datetime-local"
                  className="input"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </Field>
              <Field label="End date">
                <input
                  type="datetime-local"
                  className="input"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Total usage limit">
                <input
                  className="input"
                  inputMode="numeric"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="0 = unlimited"
                />
              </Field>
              <Field label="Per customer limit">
                <input
                  className="input"
                  inputMode="numeric"
                  value={perCustomerLimit}
                  onChange={(e) => setPerCustomerLimit(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="0 = unlimited"
                />
              </Field>
            </div>
          </Section>

          {/* Visibility */}
          <Section n={4} title="Visibility">
            <RadioOption
              label="Auto-applied at checkout"
              desc="Applied automatically — no code needed."
              checked={autoApplied}
              onClick={() => setAutoApplied(true)}
            />
            <RadioOption
              label="Requires code entry"
              desc="Customer types the code at checkout."
              checked={!autoApplied}
              onClick={() => setAutoApplied(false)}
            />
            <RadioOption
              label="Featured in app"
              desc="Show prominently on your vendor page."
              checked={featured}
              onClick={() => setFeatured(!featured)}
            />
          </Section>

          {/* Terms */}
          <Section n={5} title="Terms & Conditions" last>
            <Field label="Terms text">
              <textarea
                className="input min-h-[80px] py-3 resize-none"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Valid May 19 – Jun 30, 2025. Auto-applied at checkout. One use per customer. Cannot be combined with other offers."
              />
            </Field>
          </Section>
        </div>

        {error && (
          <div className="mx-6 mb-3 rounded-lg bg-coral-soft text-coral text-sm px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-mint-edge bg-white">
          <button onClick={onClose} className="btn-outlined">
            Cancel
          </button>
          <button onClick={submit} disabled={save.isPending} className="btn-primary">
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  n,
  title,
  last,
  children,
}: {
  n: number;
  title: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={last ? '' : 'mb-6 pb-6 border-b border-mint-edge'}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-md bg-primary text-white text-[10px] font-bold flex items-center justify-center">
          {n}
        </div>
        <div className="text-base font-bold tracking-tight text-ink">{title}</div>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label-eyebrow mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function RadioOption({
  label,
  desc,
  checked,
  onClick,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex gap-3 px-4 py-3 rounded-xl border-[1.5px] text-left transition',
        checked ? 'bg-mint border-primary' : 'bg-white border-mint-edge hover:border-primary/40',
      ].join(' ')}
    >
      <div
        className={[
          'w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
          checked ? 'border-primary bg-primary' : 'border-mint-edge',
        ].join(' ')}
      >
        {checked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
      </div>
      <div>
        <div className="text-sm font-semibold text-ink">{label}</div>
        <div className="text-xs text-ink-soft mt-0.5">{desc}</div>
      </div>
    </button>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function promoDescription(p: Promotion): string {
  if (p.type === 'percent') return `${p.value}% off`;
  if (p.type === 'fixed') return `AED ${p.value} off`;
  return 'Bundle deal';
}

function formatMD(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function suggestCode(name: string): string {
  const base = name
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .slice(0, 10);
  const num = Math.floor(Math.random() * 90) + 10;
  return (base || 'WASH') + num;
}

function todayLocal(): string {
  const d = new Date();
  return toLocalDateInputValue(d.toISOString());
}

function nextMonthLocal(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return toLocalDateInputValue(d.toISOString());
}

function toLocalDateInputValue(iso: string): string {
  // datetime-local wants "YYYY-MM-DDTHH:mm" with no timezone suffix.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } }).response;
    return resp?.data?.error?.message ?? 'Save failed';
  }
  return e instanceof Error ? e.message : 'Save failed';
}
