import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBay, getMe, setBayStatus, type AdminBay, type BayType } from '../api/admin';
import { getRealtimeSocket, type BayUpdate } from '../api/realtime';

export default function BayBoardPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    refetchInterval: 30_000, // socket pushes are primary; this is a safety net
  });

  // Subscribe to live bay updates for this vendor and patch the cache in place
  // so we never have to wait for a refetch.
  useEffect(() => {
    if (!data?.vendor.id) return;
    const sock = getRealtimeSocket();
    sock.emit('subscribe:vendor', data.vendor.id);

    const onBayUpdate = (evt: BayUpdate) => {
      if (evt.vendorId !== data.vendor.id) return;
      qc.setQueryData(['me'], (prev: typeof data | undefined) => {
        if (!prev) return prev;
        return {
          ...prev,
          vendor: {
            ...prev.vendor,
            bays: prev.vendor.bays.map((b) =>
              b.id === evt.bayId ? { ...b, status: evt.status } : b,
            ),
          },
        };
      });
    };

    sock.on('bay:update', onBayUpdate);
    return () => {
      sock.off('bay:update', onBayUpdate);
    };
  }, [data?.vendor.id, qc]);

  const toggle = useMutation({
    mutationFn: ({ bayId, status }: { bayId: string; status: AdminBay['status'] }) =>
      setBayStatus(bayId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });

  const [adding, setAdding] = useState(false);

  if (isLoading) return <div className="text-ink-soft">Loading…</div>;
  if (error) return <div className="text-coral">Couldn't load bays.</div>;
  if (!data) return null;

  const { vendor } = data;
  // Backend gates POST /admin/bays to owner + manager. We mirror the same gate
  // here so attendants don't see a button they can't use.
  const canManageBays = data.role === 'owner' || data.role === 'manager';
  const free = vendor.bays.filter((b) => b.status === 'free').length;
  const busy = vendor.bays.filter((b) => b.status === 'busy').length;
  const closed = vendor.bays.filter((b) => b.status === 'closed').length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="label-eyebrow mb-1">Live</div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Bay board</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Tap a bay to cycle its state. Customers see this as live availability.
          </p>
        </div>
        {canManageBays && !adding && (
          <button className="btn-primary" onClick={() => setAdding(true)}>
            + New bay
          </button>
        )}
      </header>

      {/* Summary chips */}
      <div className="flex gap-3">
        <Stat label="Free" count={free} bg="bg-mint" fg="text-primary-deep" />
        <Stat label="Busy" count={busy} bg="bg-coral-soft" fg="text-coral" />
        <Stat label="Closed" count={closed} bg="bg-mint-edge/40" fg="text-ink-soft" />
        <div className="ml-auto flex items-center gap-2 self-center text-xs text-ink-soft">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
          Live · updates instantly
        </div>
      </div>

      {adding && canManageBays && (
        <NewBayForm
          existingNames={vendor.bays.map((b) => b.name)}
          onCancel={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            qc.invalidateQueries({ queryKey: ['me'] });
          }}
        />
      )}

      {/* Bay grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {vendor.bays.map((bay) => (
          <BayCard
            key={bay.id}
            bay={bay}
            onCycle={(next) => toggle.mutate({ bayId: bay.id, status: next })}
          />
        ))}
        {vendor.bays.length === 0 && !adding && (
          <div className="col-span-full rounded-2xl border-2 border-dashed border-mint-edge p-8 text-center text-sm text-ink-soft">
            No bays yet.{' '}
            {canManageBays ? (
              <button
                className="font-semibold text-primary-deep hover:underline"
                onClick={() => setAdding(true)}
              >
                Add your first bay →
              </button>
            ) : (
              'Ask the vendor owner to set one up.'
            )}
          </div>
        )}
      </div>

      {/* Walk-in placeholder */}
      <div className="card mt-2 border-dashed bg-mint">
        <div className="label-eyebrow">Walk-in entry</div>
        <p className="mt-1 text-sm text-ink-soft">
          Coming soon — record a walk-in customer directly without a booking.
        </p>
      </div>
    </div>
  );
}

// ─── New-bay form ────────────────────────────────────────────────────────

function NewBayForm({
  existingNames,
  onCreated,
  onCancel,
}: {
  existingNames: string[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  // Suggest the next "Bay N" number so the user can hit Save immediately.
  const suggested = suggestNextBayName(existingNames);
  const [name, setName] = useState(suggested);
  const [bayType, setBayType] = useState<BayType>('sedan');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: createBay,
    onSuccess: onCreated,
    onError: (e: unknown) => setError(extractError(e)),
  });

  function submit() {
    setError(null);
    if (!name.trim()) return setError('Give the bay a name (e.g. "Bay 5" or "Detail Bay").');
    if (existingNames.some((n) => n.toLowerCase() === name.trim().toLowerCase())) {
      return setError(`A bay called "${name.trim()}" already exists.`);
    }
    create.mutate({ name: name.trim(), bayType });
  }

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-ink">Add a bay</h2>
        <p className="text-xs text-ink-soft">
          New bays start <strong>free</strong>. You can flip status from the grid below once it's
          live.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="label-eyebrow">Bay name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bay 5"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label-eyebrow">Bay type</span>
          <select
            className="input"
            value={bayType}
            onChange={(e) => setBayType(e.target.value as BayType)}
          >
            <option value="sedan">Sedan</option>
            <option value="suv">SUV</option>
            <option value="bike">Bike</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral">{error}</div>
      )}

      <div className="flex justify-end gap-3">
        <button className="btn-text px-4 py-2" onClick={onCancel} disabled={create.isPending}>
          Cancel
        </button>
        <button className="btn-primary" onClick={submit} disabled={create.isPending}>
          {create.isPending ? 'Adding…' : 'Add bay'}
        </button>
      </div>
    </section>
  );
}

/**
 * Suggest "Bay N" where N is the next integer not already used in the
 * existing names. Falls back to "Bay 1" if no numeric "Bay N" pattern is
 * present. Keeps the common case one-keystroke.
 */
function suggestNextBayName(existing: string[]): string {
  const taken = new Set(
    existing
      .map((n) => /^Bay\s+(\d+)$/i.exec(n.trim())?.[1])
      .filter(Boolean)
      .map(Number),
  );
  let n = 1;
  while (taken.has(n)) n++;
  return `Bay ${n}`;
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } }).response;
    return resp?.data?.error?.message ?? 'Couldn’t add the bay.';
  }
  return e instanceof Error ? e.message : 'Couldn’t add the bay.';
}

// ─── Existing components below ──────────────────────────────────────────

function Stat({ label, count, bg, fg }: { label: string; count: number; bg: string; fg: string }) {
  return (
    <div className={`flex items-baseline gap-2 rounded-xl ${bg} px-4 py-2.5`}>
      <span className={`text-2xl font-bold ${fg}`}>{count}</span>
      <span className={`text-xs font-medium ${fg}`}>{label}</span>
    </div>
  );
}

function BayCard({ bay, onCycle }: { bay: AdminBay; onCycle: (next: AdminBay['status']) => void }) {
  const next: AdminBay['status'] =
    bay.status === 'free' ? 'busy' : bay.status === 'busy' ? 'closed' : 'free';

  const colors = {
    free: { bg: 'bg-white border-primary', fg: 'text-primary-deep', chipBg: 'bg-mint', chipFg: 'text-primary-deep' },
    busy: { bg: 'bg-coral-soft border-coral', fg: 'text-coral', chipBg: 'bg-coral', chipFg: 'text-white' },
    closed: { bg: 'bg-mint-edge/30 border-mint-edge', fg: 'text-ink-soft', chipBg: 'bg-ink-soft/20', chipFg: 'text-ink-soft' },
  }[bay.status];

  return (
    <button
      onClick={() => onCycle(next)}
      className={`flex flex-col gap-3 rounded-2xl border-2 ${colors.bg} p-5 text-left transition hover:scale-[1.01]`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          {bay.bayType}
        </div>
        <div className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${colors.chipBg} ${colors.chipFg}`}>
          {bay.status}
        </div>
      </div>
      <div className={`text-2xl font-bold ${colors.fg}`}>{bay.name}</div>
      <div className="text-[11px] text-ink-soft">Tap → {next}</div>
    </button>
  );
}
