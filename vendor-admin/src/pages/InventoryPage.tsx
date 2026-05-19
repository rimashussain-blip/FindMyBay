// Vendor admin → Inventory.
//
// Two tabs:
//   - Products: catalog grouped by category, low-stock rows highlighted
//   - Movements: paginated stock-change log, filterable by reason
//
// Brand continuity: mint→sand gradient header on the low-stock banner,
// 1.5dp primary outline on cards, sand-tinted "low" pill, coral "out".

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adjustStock,
  createProduct,
  deleteProduct,
  listMovements,
  listProducts,
  updateProduct,
  type AdjustBody,
  type Product,
  type ProductCategory,
  type StockMovement,
  type StockMovementReason,
} from '../api/inventory';

type Tab = 'products' | 'movements';

const CATEGORIES: ProductCategory[] = ['soap', 'wax', 'towel', 'consumable', 'equipment', 'other'];

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>('products');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);

  const qc = useQueryClient();
  const productsQ = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const lowStock = useMemo(
    () => (productsQ.data?.items ?? []).filter((p) => p.isLowStock),
    [productsQ.data],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="label-eyebrow mb-1">Operations</div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Inventory</h1>
          <p className="mt-1 text-sm text-ink-soft max-w-[620px]">
            Track the soap, wax, towels, and bottles your bay burns through.
            Get a heads-up before you run dry — set a low-stock floor on the
            ones that matter.
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          + Add product
        </button>
      </header>

      {lowStock.length > 0 && <LowStockBanner items={lowStock} />}

      <div className="flex items-center gap-1 rounded-2xl border border-mint-edge bg-white p-1 w-fit">
        {(['products', 'movements'] as const).map((t) => {
          const on = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'rounded-xl px-4 py-2 text-sm font-semibold transition capitalize',
                on ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:text-ink',
              ].join(' ')}
            >
              {t}
            </button>
          );
        })}
      </div>

      {tab === 'products' && (
        <ProductsTab
          data={productsQ.data?.items ?? []}
          loading={productsQ.isLoading}
          error={!!productsQ.error}
          onEdit={(p) => setEditing(p)}
          onAdjust={(p) => setAdjusting(p)}
          onDelete={async (p) => {
            if (!confirm(`Archive "${p.name}"? Historical movements stay; new ones can't be logged.`)) return;
            try {
              await deleteProduct(p.id);
              qc.invalidateQueries({ queryKey: ['products'] });
            } catch (e) {
              alert(extractError(e));
            }
          }}
        />
      )}

      {tab === 'movements' && <MovementsTab />}

      {(creating || editing) && (
        <ProductModal
          existing={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => qc.invalidateQueries({ queryKey: ['products'] })}
        />
      )}

      {adjusting && (
        <AdjustModal
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['products'] });
            qc.invalidateQueries({ queryKey: ['movements'] });
          }}
        />
      )}
    </div>
  );
}

// ── Low-stock banner ─────────────────────────────────────────────────────

function LowStockBanner({
  items,
}: {
  items: Array<{ id: string; name: string; stockQty: number; lowStockThreshold: number; unit: string }>;
}) {
  return (
    <div
      className="rounded-2xl border-[1.5px] border-amber/60 overflow-hidden"
      style={{ boxShadow: '0 4px 14px rgba(245, 199, 126, 0.20)' }}
    >
      <div
        className="px-5 py-3 flex items-center gap-2 flex-wrap"
        style={{ backgroundImage: 'linear-gradient(135deg, #FBF1DF, #FCE7C8)' }}
      >
        <span
          className="rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{ color: '#7a4d12' }}
        >
          Low stock — {items.length}
        </span>
        <span className="text-xs text-ink-soft">
          Restock soon to avoid mid-wash interruptions.
        </span>
      </div>
      <div className="px-5 py-3 flex flex-wrap gap-2 bg-cream/50">
        {items.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-2 rounded-full bg-white border border-mint-edge px-3 py-1.5 text-xs"
          >
            <span className="font-semibold text-ink">{p.name}</span>
            <span
              className={[
                'rounded-full px-2 py-0.5 text-[10px] font-bold',
                p.stockQty <= 0
                  ? 'bg-coral-soft text-coral'
                  : 'bg-amber/30 text-[#7a4d12]',
              ].join(' ')}
            >
              {p.stockQty <= 0 ? 'Out' : `${p.stockQty} ${p.unit} left`}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Products tab ─────────────────────────────────────────────────────────

function ProductsTab({
  data,
  loading,
  error,
  onEdit,
  onAdjust,
  onDelete,
}: {
  data: Product[];
  loading: boolean;
  error: boolean;
  onEdit: (p: Product) => void;
  onAdjust: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  if (loading) return <Skeleton />;
  if (error)
    return (
      <div className="rounded-xl bg-coral-soft text-coral p-4 text-sm">
        Couldn't load products.
      </div>
    );
  if (data.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-mint-edge bg-white/60 p-10 text-center">
        <div className="text-ink font-bold text-lg">No products yet</div>
        <div className="mt-1.5 text-sm text-ink-soft max-w-[420px] mx-auto">
          Start with the basics — your top-shelf soap, your wax bottles, the
          microfiber towels you go through. You'll get a "low stock" heads-up
          before you run out.
        </div>
      </div>
    );

  const byCategory = CATEGORIES.map((c) => ({
    category: c,
    items: data.filter((p) => p.category === c),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {byCategory.map((g) => (
        <section key={g.category}>
          <h2 className="text-lg font-bold text-ink mb-3 capitalize">
            {prettyCategory(g.category)}{' '}
            <span className="text-ink-soft font-medium">({g.items.length})</span>
          </h2>
          <div className="rounded-2xl border border-mint-edge bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-mint/40 text-left text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Threshold</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mint-edge">
                {g.items.map((p) => (
                  <tr key={p.id} className="hover:bg-mint/20">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink flex items-center gap-2">
                        {p.name}
                        {p.isLowStock && (
                          <span
                            className={[
                              'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                              p.stockQty <= 0
                                ? 'bg-coral-soft text-coral'
                                : 'bg-amber/30 text-[#7a4d12]',
                            ].join(' ')}
                          >
                            {p.stockQty <= 0 ? 'Out' : 'Low'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">{p.sku ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-ink">{p.stockQty}</span>{' '}
                      <span className="text-ink-soft">{p.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-soft">
                      {p.lowStockThreshold > 0 ? `${p.lowStockThreshold} ${p.unit}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-soft">
                      {p.costAed != null ? `AED ${p.costAed}/${p.unit}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{p.location ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => onAdjust(p)}
                          className="rounded-lg border border-mint-edge bg-white px-3 py-1.5 text-xs font-semibold text-primary-deep hover:bg-mint"
                        >
                          Adjust
                        </button>
                        <button
                          onClick={() => onEdit(p)}
                          className="rounded-lg border border-mint-edge bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-mint hover:text-ink"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(p)}
                          className="rounded-lg bg-coral-soft px-3 py-1.5 text-xs font-semibold text-coral hover:bg-coral hover:text-white"
                          aria-label={`Archive ${p.name}`}
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Movements tab ────────────────────────────────────────────────────────

function MovementsTab() {
  const [reason, setReason] = useState<StockMovementReason | 'all'>('all');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['movements', reason, page],
    queryFn: () =>
      listMovements({
        reason: reason === 'all' ? undefined : reason,
        page,
        pageSize: 30,
      }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          className="rounded-lg border border-mint-edge bg-white px-3 py-2 text-sm text-ink"
          value={reason}
          onChange={(e) => {
            setPage(1);
            setReason(e.target.value as StockMovementReason | 'all');
          }}
        >
          <option value="all">All reasons</option>
          <option value="restock">Restock</option>
          <option value="adjustment">Adjustment</option>
          <option value="used_in_wash">Used in wash</option>
          <option value="shrinkage">Shrinkage</option>
          <option value="initial_stock">Initial stock</option>
        </select>
        <div className="ml-auto text-xs text-ink-soft">
          {data ? `${data.total.toLocaleString()} movements` : '…'}
        </div>
      </div>

      <div className="rounded-2xl border border-mint-edge bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-mint/40 text-left text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3 text-right">Delta</th>
              <th className="px-4 py-3 text-right">Resulting qty</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mint-edge">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-soft">
                  Loading…
                </td>
              </tr>
            )}
            {data?.items.length === 0 && !isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-soft">
                  No movements yet.
                </td>
              </tr>
            )}
            {data?.items.map((m) => <MovementRow key={m.id} m={m} />)}
          </tbody>
        </table>
      </div>

      {data && data.total > data.pageSize && (
        <Pagination
          page={page}
          totalPages={Math.ceil(data.total / data.pageSize)}
          onChange={setPage}
        />
      )}
    </div>
  );
}

function MovementRow({ m }: { m: StockMovement }) {
  const inflow = m.delta > 0;
  return (
    <tr className="hover:bg-mint/20">
      <td className="px-4 py-3 text-ink-soft">{formatDateTime(m.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="font-medium text-ink">{m.product.name}</div>
        <div className="text-xs text-ink-soft capitalize">{prettyCategory(m.product.category)}</div>
      </td>
      <td className="px-4 py-3">
        <ReasonChip reason={m.reason} />
      </td>
      <td
        className={[
          'px-4 py-3 text-right font-semibold',
          inflow ? 'text-primary-deep' : 'text-coral',
        ].join(' ')}
      >
        {inflow ? '+' : ''}
        {m.delta} {m.product.unit}
      </td>
      <td className="px-4 py-3 text-right text-ink">
        {m.resultingQty} {m.product.unit}
      </td>
      <td className="px-4 py-3 text-xs text-ink-soft max-w-[260px] truncate" title={m.note ?? ''}>
        {m.note ?? '—'}
      </td>
    </tr>
  );
}

function ReasonChip({ reason }: { reason: StockMovementReason }) {
  const palette: Record<StockMovementReason, string> = {
    restock: 'bg-mint text-primary-deep',
    adjustment: 'bg-mint-edge text-ink-soft',
    used_in_wash: 'bg-sand text-[#7a4d12]',
    shrinkage: 'bg-coral-soft text-coral',
    initial_stock: 'bg-cream-2 text-ink-soft',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${palette[reason]}`}
    >
      {reason.replace(/_/g, ' ')}
    </span>
  );
}

// ── Product modal ────────────────────────────────────────────────────────

function ProductModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [sku, setSku] = useState(existing?.sku ?? '');
  const [category, setCategory] = useState<ProductCategory>(existing?.category ?? 'other');
  const [unit, setUnit] = useState(existing?.unit ?? 'pcs');
  const [costAed, setCostAed] = useState<string>(existing?.costAed != null ? String(existing.costAed) : '');
  const [lowStockThreshold, setLowStockThreshold] = useState<string>(
    String(existing?.lowStockThreshold ?? 0),
  );
  const [location, setLocation] = useState(existing?.location ?? '');
  const [initialQty, setInitialQty] = useState('0');

  const mut = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        sku: sku.trim() || null,
        category,
        unit: unit.trim() || 'pcs',
        costAed: costAed ? Number(costAed) : null,
        lowStockThreshold: Number(lowStockThreshold) || 0,
        location: location.trim() || null,
      };
      if (existing) {
        return updateProduct(existing.id, body);
      }
      return createProduct({ ...body, initialQty: Number(initialQty) || 0 });
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  return (
    <ModalShell title={existing ? 'Edit product' : 'Add product'} onClose={onClose}>
      <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <div className="label-eyebrow mb-1.5">Name</div>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Chemical Guys Mr Pink"
              autoFocus
            />
          </div>
          <div>
            <div className="label-eyebrow mb-1.5">Category</div>
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {prettyCategory(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="label-eyebrow mb-1.5">Unit</div>
            <input
              className="input"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="L, ml, pcs, kg"
            />
          </div>
          <div>
            <div className="label-eyebrow mb-1.5">SKU (optional)</div>
            <input
              className="input"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="MRP-3.7L"
            />
          </div>
          <div>
            <div className="label-eyebrow mb-1.5">Cost per unit (AED)</div>
            <input
              type="number"
              className="input"
              value={costAed}
              onChange={(e) => setCostAed(e.target.value)}
              placeholder="—"
              min={0}
            />
          </div>
          <div>
            <div className="label-eyebrow mb-1.5">Low-stock threshold</div>
            <input
              type="number"
              className="input"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              placeholder="0 disables alert"
              min={0}
            />
          </div>
          <div>
            <div className="label-eyebrow mb-1.5">Location</div>
            <input
              className="input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Storeroom shelf 2"
            />
          </div>
          {!existing && (
            <div className="col-span-2">
              <div className="label-eyebrow mb-1.5">Opening stock</div>
              <input
                type="number"
                className="input"
                value={initialQty}
                onChange={(e) => setInitialQty(e.target.value)}
                placeholder="0"
                min={0}
              />
              <p className="mt-1 text-xs text-ink-soft">
                We'll log an "initial stock" movement so the audit trail starts clean.
              </p>
            </div>
          )}
        </div>

        {mut.error && (
          <div className="rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral">
            {extractError(mut.error)}
          </div>
        )}

        <div className="mt-2 flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-outlined">
            Cancel
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={!name.trim() || !unit.trim() || mut.isPending}
            className="btn-primary"
          >
            {mut.isPending ? 'Saving…' : existing ? 'Save changes' : 'Add product'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Adjust stock modal ───────────────────────────────────────────────────

function AdjustModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState<AdjustBody['reason']>('restock');
  const [note, setNote] = useState('');

  const numQty = Math.max(0, Number(qty) || 0);
  const delta = mode === 'add' ? numQty : -numQty;
  const projected = product.stockQty + delta;

  const mut = useMutation({
    mutationFn: () =>
      adjustStock(product.id, {
        delta,
        reason: mode === 'add' ? 'restock' : reason,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  // When mode flips to "add", lock reason to restock; when "remove",
  // let the user pick adjustment / shrinkage. (V1 doesn't expose
  // used_in_wash from the UI — that's reserved for the auto-deduct path.)
  const removeReasons: Array<{ value: AdjustBody['reason']; label: string }> = [
    { value: 'adjustment', label: 'Manual correction' },
    { value: 'shrinkage', label: 'Shrinkage / breakage' },
  ];

  return (
    <ModalShell title={`Adjust stock — ${product.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-mint-edge bg-mint/30 p-3 text-xs text-ink-soft">
          Current stock:{' '}
          <span className="font-semibold text-ink">
            {product.stockQty} {product.unit}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['add', 'remove'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={[
                'rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize transition',
                mode === m
                  ? m === 'add'
                    ? 'border-primary bg-mint text-primary-deep'
                    : 'border-coral bg-coral-soft text-coral'
                  : 'border-mint-edge bg-white text-ink-soft hover:bg-mint/30',
              ].join(' ')}
            >
              {m === 'add' ? '+ Add stock' : '− Remove stock'}
            </button>
          ))}
        </div>

        <div>
          <div className="label-eyebrow mb-1.5">Quantity ({product.unit})</div>
          <input
            type="number"
            className="input"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            min={0}
            autoFocus
          />
          <p
            className={[
              'mt-1.5 text-xs',
              projected < 0 ? 'text-coral font-semibold' : 'text-ink-soft',
            ].join(' ')}
          >
            New balance: <span className="font-semibold">{projected}</span> {product.unit}
            {projected < 0 && ' — can\'t go below zero'}
          </p>
        </div>

        {mode === 'remove' && (
          <div>
            <div className="label-eyebrow mb-1.5">Reason</div>
            <div className="grid grid-cols-2 gap-2">
              {removeReasons.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={[
                    'rounded-xl border px-3 py-2.5 text-xs font-semibold transition',
                    reason === r.value
                      ? 'border-primary bg-mint text-primary-deep'
                      : 'border-mint-edge bg-white text-ink-soft hover:bg-mint/30',
                  ].join(' ')}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="label-eyebrow mb-1.5">Note (optional)</div>
          <textarea
            className="input min-h-[64px] resize-y"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              mode === 'add'
                ? 'Restock receipt #1234'
                : 'Bottle dropped, replaced from spare'
            }
            maxLength={280}
          />
        </div>

        {mut.error && (
          <div className="rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral">
            {extractError(mut.error)}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-outlined">
            Cancel
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={!numQty || projected < 0 || mut.isPending}
            className="btn-primary"
          >
            {mut.isPending ? 'Saving…' : mode === 'add' ? `+ Add ${numQty}` : `− Remove ${numQty}`}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

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

function prettyCategory(c: ProductCategory): string {
  const map: Record<ProductCategory, string> = {
    soap: 'Soap & shampoo',
    wax: 'Wax & polish',
    towel: 'Towels & cloths',
    consumable: 'Consumables',
    equipment: 'Equipment',
    other: 'Other',
  };
  return map[c];
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-AE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } }).response;
    return resp?.data?.error?.message ?? 'Request failed';
  }
  return e instanceof Error ? e.message : 'Request failed';
}
