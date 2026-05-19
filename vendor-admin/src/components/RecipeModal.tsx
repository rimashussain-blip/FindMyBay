// Service recipe editor — picks which products a service consumes per
// wash so the auto-deduct hook in the booking-status route knows what
// stock to drop when the booking is marked completed.
//
// Surface: a modal opened from the Services page row's "Recipe" button.
// Lists every product on the left (with category + unit), the current
// recipe on the right with an editable qty input. Save replaces the
// recipe atomically (PUT, not PATCH).

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getServiceRecipe, listProducts, putServiceRecipe, type Product } from '../api/inventory';

export function RecipeModal({
  serviceId,
  serviceName,
  onClose,
}: {
  serviceId: string;
  serviceName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const productsQ = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const recipeQ = useQuery({
    queryKey: ['recipe', serviceId],
    queryFn: () => getServiceRecipe(serviceId),
  });

  // Local edit state — map of productId → qtyPerWash. Seeded from the
  // server response when it lands; user changes layer on top.
  const [recipe, setRecipe] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (recipeQ.data) {
      const m = new Map<string, number>();
      for (const i of recipeQ.data.items) m.set(i.productId, i.qtyPerWash);
      setRecipe(m);
    }
  }, [recipeQ.data]);

  const mut = useMutation({
    mutationFn: () =>
      putServiceRecipe(
        serviceId,
        Array.from(recipe.entries()).map(([productId, qtyPerWash]) => ({
          productId,
          qtyPerWash,
        })),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipe', serviceId] });
      onClose();
    },
  });

  const products = productsQ.data?.items ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-mint-edge">
          <div>
            <h3 className="text-lg font-bold text-ink">Recipe — {serviceName}</h3>
            <p className="text-xs text-ink-soft mt-0.5">
              Stock listed here is auto-deducted when this service's bookings are marked completed.
            </p>
          </div>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-3">
          {productsQ.isLoading || recipeQ.isLoading ? (
            <div className="text-sm text-ink-soft">Loading…</div>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-dashed border-mint-edge bg-white/60 p-6 text-center">
              <div className="font-bold text-ink">No products in your catalog yet</div>
              <p className="text-sm text-ink-soft mt-1.5">
                Add products on the Inventory page, then come back here to link them to this service.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-mint-edge overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-mint/40 text-left text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                    <th className="px-3 py-2">Include</th>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">In stock</th>
                    <th className="px-3 py-2 text-right">Qty per wash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mint-edge">
                  {products.map((p) => (
                    <RecipeRow
                      key={p.id}
                      product={p}
                      qty={recipe.get(p.id)}
                      onToggle={(included, qty) => {
                        const next = new Map(recipe);
                        if (included) next.set(p.id, qty);
                        else next.delete(p.id);
                        setRecipe(next);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

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
              disabled={mut.isPending}
              className="btn-primary"
            >
              {mut.isPending ? 'Saving…' : `Save recipe (${recipe.size} item${recipe.size === 1 ? '' : 's'})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecipeRow({
  product,
  qty,
  onToggle,
}: {
  product: Product;
  qty: number | undefined;
  onToggle: (included: boolean, qty: number) => void;
}) {
  const included = qty !== undefined;
  return (
    <tr className="hover:bg-mint/20">
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={included}
          onChange={(e) => onToggle(e.target.checked, qty ?? 1)}
          className="h-4 w-4 rounded text-primary"
        />
      </td>
      <td className="px-3 py-2">
        <div className="font-semibold text-ink">{product.name}</div>
        <div className="text-xs text-ink-soft capitalize">{product.category} · {product.unit}</div>
      </td>
      <td className="px-3 py-2 text-right">
        <span
          className={[
            'font-semibold',
            product.isLowStock ? 'text-coral' : 'text-ink',
          ].join(' ')}
        >
          {product.stockQty} {product.unit}
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          className="w-24 rounded-lg border border-mint-edge bg-white px-2 py-1 text-right text-sm text-ink disabled:opacity-40"
          value={qty ?? ''}
          disabled={!included}
          min={1}
          max={1000}
          onChange={(e) => onToggle(true, Math.max(1, Number(e.target.value) || 1))}
        />
      </td>
    </tr>
  );
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } }).response;
    return resp?.data?.error?.message ?? 'Request failed';
  }
  return e instanceof Error ? e.message : 'Request failed';
}
