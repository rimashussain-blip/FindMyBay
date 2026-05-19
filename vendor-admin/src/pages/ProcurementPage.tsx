// Vendor admin → Procurement (suppliers + purchase orders).
//
// Sibling page to Inventory. Lets the owner manage who they buy from
// and walk a PO through draft → submitted → received, with stock
// auto-restocking on receive (the backend posts one StockMovement
// per item with reason='restock').

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  createSupplier,
  deleteSupplier,
  listProducts,
  listPurchaseOrders,
  listSuppliers,
  receivePurchaseOrder,
  submitPurchaseOrder,
  updatePurchaseOrder,
  updateSupplier,
  type CreatePoBody,
  type PoStatus,
  type Product,
  type PurchaseOrder,
  type Supplier,
} from '../api/inventory';

type Tab = 'orders' | 'suppliers';

export default function ProcurementPage() {
  const [tab, setTab] = useState<Tab>('orders');
  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="label-eyebrow mb-1">Inventory</div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Procurement</h1>
        <p className="mt-1 text-sm text-ink-soft max-w-[620px]">
          Order consumables from your suppliers. When a PO is marked
          received, stock counts update automatically — no second trip to
          the Inventory page.
        </p>
      </header>

      <div className="flex items-center gap-1 rounded-2xl border border-mint-edge bg-white p-1 w-fit">
        {(['orders', 'suppliers'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'rounded-xl px-4 py-2 text-sm font-semibold transition capitalize',
              tab === t ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:text-ink',
            ].join(' ')}
          >
            {t === 'orders' ? 'Purchase orders' : 'Suppliers'}
          </button>
        ))}
      </div>

      {tab === 'orders' ? <OrdersTab /> : <SuppliersTab />}
    </div>
  );
}

// ── Orders tab ───────────────────────────────────────────────────────────

function OrdersTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<PoStatus | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);

  const ordersQ = useQuery({
    queryKey: ['purchase-orders', statusFilter],
    queryFn: () => listPurchaseOrders(statusFilter === 'all' ? undefined : statusFilter),
  });

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    qc.invalidateQueries({ queryKey: ['products'] }); // receive bumps stock
    qc.invalidateQueries({ queryKey: ['movements'] });
  }

  const submit = useMutation({ mutationFn: submitPurchaseOrder, onSuccess: invalidateAll });
  const receive = useMutation({ mutationFn: receivePurchaseOrder, onSuccess: invalidateAll });
  const cancel = useMutation({ mutationFn: cancelPurchaseOrder, onSuccess: invalidateAll });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-mint-edge bg-white px-3 py-2 text-sm text-ink"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PoStatus | 'all')}
          >
            <option value="all">All POs</option>
            <option value="draft">Drafts</option>
            <option value="submitted">Submitted</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <span className="text-xs text-ink-soft">
            {ordersQ.data?.items.length ?? 0} order{ordersQ.data?.items.length === 1 ? '' : 's'}
          </span>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          + New purchase order
        </button>
      </div>

      <div className="rounded-2xl border border-mint-edge bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-mint/40 text-left text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3 text-right">Items</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Expected</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mint-edge">
            {ordersQ.isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-ink-soft">
                  Loading…
                </td>
              </tr>
            )}
            {ordersQ.data?.items.length === 0 && !ordersQ.isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-ink-soft">
                  No purchase orders yet. Create one to start tracking incoming stock.
                </td>
              </tr>
            )}
            {ordersQ.data?.items.map((po) => (
              <PoRow
                key={po.id}
                po={po}
                onEdit={() => setEditing(po)}
                onSubmit={() => submit.mutate(po.id)}
                onReceive={() => {
                  if (!confirm(`Mark ${po.reference} as received? This will restock ${po.items.length} item${po.items.length === 1 ? '' : 's'}.`)) return;
                  receive.mutate(po.id);
                }}
                onCancel={() => {
                  if (!confirm(`Cancel ${po.reference}? No stock will move.`)) return;
                  cancel.mutate(po.id);
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <PoModal
          existing={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={invalidateAll}
        />
      )}
    </div>
  );
}

function PoRow({
  po,
  onEdit,
  onSubmit,
  onReceive,
  onCancel,
}: {
  po: PurchaseOrder;
  onEdit: () => void;
  onSubmit: () => void;
  onReceive: () => void;
  onCancel: () => void;
}) {
  return (
    <tr className="hover:bg-mint/20">
      <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">{po.reference}</td>
      <td className="px-4 py-3 text-ink">{po.supplier.name}</td>
      <td className="px-4 py-3 text-right text-ink-soft">{po.items.length}</td>
      <td className="px-4 py-3 text-right font-semibold text-ink">AED {po.totalAed.toLocaleString()}</td>
      <td className="px-4 py-3">
        <PoStatusChip status={po.status} />
      </td>
      <td className="px-4 py-3 text-xs text-ink-soft">
        {po.status === 'received'
          ? po.receivedAt
            ? `Received ${formatShortDate(po.receivedAt)}`
            : '—'
          : po.expectedAt
            ? formatShortDate(po.expectedAt)
            : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
          {po.status === 'draft' && (
            <>
              <button onClick={onEdit} className="rounded-lg border border-mint-edge bg-white px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-mint hover:text-ink">
                Edit
              </button>
              <button onClick={onSubmit} className="rounded-lg bg-primary-deep px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90">
                Submit
              </button>
              <button onClick={onCancel} className="rounded-lg bg-coral-soft px-2.5 py-1 text-xs font-semibold text-coral hover:bg-coral hover:text-white">
                Cancel
              </button>
            </>
          )}
          {po.status === 'submitted' && (
            <>
              <button onClick={onReceive} className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90">
                Mark received
              </button>
              <button onClick={onCancel} className="rounded-lg bg-coral-soft px-2.5 py-1 text-xs font-semibold text-coral hover:bg-coral hover:text-white">
                Cancel
              </button>
            </>
          )}
          <button onClick={onEdit} className="rounded-lg border border-mint-edge bg-white px-2.5 py-1 text-xs font-semibold text-primary-deep hover:bg-mint">
            View
          </button>
        </div>
      </td>
    </tr>
  );
}

function PoStatusChip({ status }: { status: PoStatus }) {
  const map: Record<PoStatus, { label: string; classes: string }> = {
    draft:     { label: 'Draft',     classes: 'bg-mint-edge text-ink-soft' },
    submitted: { label: 'Submitted', classes: 'bg-sand text-[#7a4d12]' },
    received:  { label: 'Received',  classes: 'bg-mint text-primary-deep' },
    cancelled: { label: 'Cancelled', classes: 'bg-coral-soft text-coral' },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${m.classes}`}>
      {m.label}
    </span>
  );
}

// ── PO modal (create / edit) ─────────────────────────────────────────────

function PoModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: PurchaseOrder | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const suppliersQ = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });
  const productsQ = useQuery({ queryKey: ['products'], queryFn: listProducts });

  const [supplierId, setSupplierId] = useState(existing?.supplier.id ?? '');
  const [expectedAt, setExpectedAt] = useState(existing?.expectedAt?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [items, setItems] = useState<Array<{ productId: string; qty: number; unitCostAed: number }>>(
    existing?.items.map((i) => ({
      productId: i.productId,
      qty: i.qty,
      unitCostAed: i.unitCostAed,
    })) ?? [],
  );

  const isLocked = existing && existing.status !== 'draft';

  const products = productsQ.data?.items ?? [];
  const suppliers = suppliersQ.data?.items ?? [];
  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p] as const)),
    [products],
  );
  const total = items.reduce((s, i) => s + i.qty * i.unitCostAed, 0);

  const mut = useMutation({
    mutationFn: async () => {
      const body: CreatePoBody = {
        supplierId,
        expectedAt: expectedAt ? new Date(expectedAt).toISOString() : null,
        notes: notes.trim() || null,
        items,
      };
      if (existing) return updatePurchaseOrder(existing.id, body);
      return createPurchaseOrder(body);
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  function addItem(p: Product) {
    if (items.some((i) => i.productId === p.id)) return;
    setItems([...items, { productId: p.id, qty: 1, unitCostAed: p.costAed ?? 0 }]);
  }
  function updateItem(productId: string, patch: Partial<{ qty: number; unitCostAed: number }>) {
    setItems(items.map((i) => (i.productId === productId ? { ...i, ...patch } : i)));
  }
  function removeItem(productId: string) {
    setItems(items.filter((i) => i.productId !== productId));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-mint-edge">
          <div>
            <h3 className="text-lg font-bold text-ink">
              {existing ? existing.reference : 'New purchase order'}
            </h3>
            {existing && <PoStatusChip status={existing.status} />}
          </div>
          <button onClick={onClose} className="text-ink-soft hover:text-ink">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label-eyebrow mb-1.5">Supplier</div>
              <select
                className="input"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                disabled={!!isLocked}
              >
                <option value="">— Pick a supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="label-eyebrow mb-1.5">Expected delivery</div>
              <input
                type="date"
                className="input"
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.target.value)}
                disabled={!!isLocked}
              />
            </div>
          </div>

          <div>
            <div className="label-eyebrow mb-1.5">Items</div>
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-mint-edge bg-white/60 p-4 text-center text-sm text-ink-soft">
                No items yet. Pick a product below to add it.
              </div>
            ) : (
              <div className="rounded-xl border border-mint-edge overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-mint/40 text-left text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit cost (AED)</th>
                      <th className="px-3 py-2 text-right">Line total</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mint-edge">
                    {items.map((i) => {
                      const p = productById.get(i.productId);
                      return (
                        <tr key={i.productId}>
                          <td className="px-3 py-2">
                            <div className="font-medium text-ink">{p?.name ?? '—'}</div>
                            <div className="text-[11px] text-ink-soft">{p?.unit}</div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              className="w-20 rounded-lg border border-mint-edge bg-white px-2 py-1 text-right text-sm disabled:opacity-40"
                              value={i.qty}
                              min={1}
                              onChange={(e) =>
                                updateItem(i.productId, { qty: Math.max(1, Number(e.target.value) || 1) })
                              }
                              disabled={!!isLocked}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              className="w-24 rounded-lg border border-mint-edge bg-white px-2 py-1 text-right text-sm disabled:opacity-40"
                              value={i.unitCostAed}
                              min={0}
                              onChange={(e) =>
                                updateItem(i.productId, {
                                  unitCostAed: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              disabled={!!isLocked}
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-ink">
                            AED {(i.qty * i.unitCostAed).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {!isLocked && (
                              <button
                                onClick={() => removeItem(i.productId)}
                                className="text-coral hover:underline text-xs"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-mint/30 font-bold">
                      <td colSpan={3} className="px-3 py-2 text-right text-ink">
                        Total
                      </td>
                      <td className="px-3 py-2 text-right text-ink">AED {total.toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {!isLocked && (
              <div className="mt-2 flex items-center gap-2">
                <select
                  className="input flex-1"
                  value=""
                  onChange={(e) => {
                    const p = productById.get(e.target.value);
                    if (p) addItem(p);
                  }}
                >
                  <option value="">+ Add product…</option>
                  {products
                    .filter((p) => !items.some((i) => i.productId === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.unit}) {p.costAed != null ? `· AED ${p.costAed}` : ''}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <div className="label-eyebrow mb-1.5">Notes</div>
            <textarea
              className="input min-h-[60px] resize-y disabled:opacity-40"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery instructions, payment terms, etc."
              maxLength={1000}
              disabled={!!isLocked}
            />
          </div>

          {mut.error && (
            <div className="rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral">
              {extractError(mut.error)}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="btn-outlined">
              {isLocked ? 'Close' : 'Cancel'}
            </button>
            {!isLocked && (
              <button
                onClick={() => mut.mutate()}
                disabled={!supplierId || items.length === 0 || mut.isPending}
                className="btn-primary"
              >
                {mut.isPending ? 'Saving…' : existing ? 'Save changes' : 'Save draft'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Suppliers tab ────────────────────────────────────────────────────────

function SuppliersTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-soft">
          {data?.items.length ?? 0} supplier{data?.items.length === 1 ? '' : 's'}
        </span>
        <button onClick={() => setCreating(true)} className="btn-primary">
          + New supplier
        </button>
      </div>

      <div className="rounded-2xl border border-mint-edge bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-mint/40 text-left text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mint-edge">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-soft">
                  Loading…
                </td>
              </tr>
            )}
            {data?.items.length === 0 && !isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-soft">
                  No suppliers yet. Add your first one to start creating purchase orders.
                </td>
              </tr>
            )}
            {data?.items.map((s) => (
              <tr key={s.id} className="hover:bg-mint/20">
                <td className="px-4 py-3 font-semibold text-ink">{s.name}</td>
                <td className="px-4 py-3 text-ink-soft">{s.contactName ?? '—'}</td>
                <td className="px-4 py-3 text-ink-soft">{s.phone ?? '—'}</td>
                <td className="px-4 py-3 text-ink-soft">{s.email ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setEditing(s)}
                    className="rounded-lg border border-mint-edge bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-mint hover:text-ink mr-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Archive supplier "${s.name}"?`)) return;
                      try {
                        await deleteSupplier(s.id);
                        qc.invalidateQueries({ queryKey: ['suppliers'] });
                      } catch (e) {
                        alert(extractError(e));
                      }
                    }}
                    className="rounded-lg bg-coral-soft px-3 py-1.5 text-xs font-semibold text-coral hover:bg-coral hover:text-white"
                  >
                    Archive
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <SupplierModal
          existing={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => qc.invalidateQueries({ queryKey: ['suppliers'] })}
        />
      )}
    </div>
  );
}

function SupplierModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: Supplier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [contactName, setContactName] = useState(existing?.contactName ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const mut = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        contactName: contactName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
      };
      return existing ? updateSupplier(existing.id, body) : createSupplier(body);
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl my-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">{existing ? 'Edit supplier' : 'Add supplier'}</h3>
          <button onClick={onClose} className="text-ink-soft hover:text-ink">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <div className="label-eyebrow mb-1.5">Name</div>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <div className="label-eyebrow mb-1.5">Contact name (optional)</div>
            <input
              className="input"
              value={contactName ?? ''}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label-eyebrow mb-1.5">Phone</div>
              <input
                className="input"
                value={phone ?? ''}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+971 50…"
              />
            </div>
            <div>
              <div className="label-eyebrow mb-1.5">Email</div>
              <input
                type="email"
                className="input"
                value={email ?? ''}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div>
            <div className="label-eyebrow mb-1.5">Notes</div>
            <textarea
              className="input min-h-[60px] resize-y"
              value={notes ?? ''}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              placeholder="Lead time, MOQ, payment terms…"
            />
          </div>

          {mut.error && (
            <div className="rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral">
              {extractError(mut.error)}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 mt-2">
            <button onClick={onClose} className="btn-outlined">
              Cancel
            </button>
            <button
              onClick={() => mut.mutate()}
              disabled={!name.trim() || mut.isPending}
              className="btn-primary"
            >
              {mut.isPending ? 'Saving…' : existing ? 'Save changes' : 'Add supplier'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Misc ─────────────────────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AE', {
    day: 'numeric',
    month: 'short',
  });
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } }).response;
    return resp?.data?.error?.message ?? 'Request failed';
  }
  return e instanceof Error ? e.message : 'Request failed';
}
