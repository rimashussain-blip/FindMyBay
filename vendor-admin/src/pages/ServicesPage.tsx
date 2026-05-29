import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createService,
  deleteService,
  getMe,
  updateService,
  type AdminService,
} from '../api/admin';
import { RecipeModal } from '../components/RecipeModal';

export default function ServicesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: getMe });
  const [adding, setAdding] = useState(false);
  const [recipeService, setRecipeService] = useState<AdminService | null>(null);

  const create = useMutation({
    mutationFn: createService,
    onSuccess: () => {
      setAdding(false);
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Omit<AdminService, 'id'>> }) =>
      updateService(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
  const remove = useMutation({
    mutationFn: deleteService,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });

  if (isLoading) return <div className="text-ink-soft">Loading…</div>;
  const services = data?.vendor.services ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="label-eyebrow mb-1">Catalog</div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Services & pricing</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Edit prices and durations. Customers see these on your detail page.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          + New service
        </button>
      </header>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-mint">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-primary-deep">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 text-right">Duration</th>
              <th className="px-4 py-3 text-right">Price (AED)</th>
              <th className="px-4 py-3">VAT</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.length === 0 && !adding && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-ink-soft">
                  No services yet. Add one to start receiving bookings.
                </td>
              </tr>
            )}
            {services.map((s) => (
              <ServiceRow
                key={s.id}
                svc={s}
                onSave={(body) => update.mutate({ id: s.id, body })}
                onDelete={() => {
                  if (confirm(`Delete "${s.name}"? This can't be undone.`)) remove.mutate(s.id);
                }}
                onRecipe={() => setRecipeService(s)}
              />
            ))}
            {adding && (
              <ServiceRow
                svc={{ id: 'new', name: '', durationMin: 30, priceAed: 50, vatInclusive: true }}
                isNew
                onSave={(body) => {
                  create.mutate({
                    name: body.name ?? '',
                    durationMin: body.durationMin ?? 30,
                    priceAed: body.priceAed ?? 50,
                    vatInclusive: body.vatInclusive ?? true,
                  });
                }}
                onDelete={() => setAdding(false)}
              />
            )}
          </tbody>
        </table>
      </div>

      {recipeService && (
        <RecipeModal
          serviceId={recipeService.id}
          serviceName={recipeService.name}
          onClose={() => setRecipeService(null)}
        />
      )}
    </div>
  );
}

function ServiceRow({
  svc,
  isNew,
  onSave,
  onDelete,
  onRecipe,
}: {
  svc: AdminService;
  isNew?: boolean;
  onSave: (body: Partial<Omit<AdminService, 'id'>>) => void;
  onDelete: () => void;
  onRecipe?: () => void;
}) {
  const [editing, setEditing] = useState(!!isNew);
  const [name, setName] = useState(svc.name);
  const [duration, setDuration] = useState(svc.durationMin);
  const [price, setPrice] = useState(svc.priceAed);
  const [vatInclusive, setVatInclusive] = useState(svc.vatInclusive);

  if (!editing) {
    return (
      <tr className="border-t border-mint-edge">
        <td className="px-4 py-3 font-medium text-ink">{svc.name}</td>
        <td className="px-4 py-3 text-right text-ink-soft">{svc.durationMin} min</td>
        <td className="px-4 py-3 text-right font-bold text-primary-deep">AED {svc.priceAed}</td>
        <td className="px-4 py-3 text-ink-soft">{svc.vatInclusive ? 'Inc.' : 'Excl.'}</td>
        <td className="px-4 py-3 text-right">
          {onRecipe && (
            <button
              className="rounded-lg border border-mint-edge bg-white px-2.5 py-1 text-xs font-semibold text-primary-deep hover:bg-mint mr-2"
              onClick={onRecipe}
            >
              Recipe
            </button>
          )}
          <button className="btn-text mr-3" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="text-xs font-medium text-coral hover:underline" onClick={onDelete}>
            Delete
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-mint-edge bg-mint">
      <td className="px-4 py-3">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Quick wash" />
      </td>
      <td className="px-4 py-3 text-right">
        <input
          className="input w-24 text-right"
          type="number"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          min={5}
          max={360}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <input
          className="input w-24 text-right"
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          min={0}
        />
      </td>
      <td className="px-4 py-3">
        <label className="inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={vatInclusive}
            onChange={(e) => setVatInclusive(e.target.checked)}
            className="rounded"
          />
          VAT inclusive
        </label>
      </td>
      <td className="px-4 py-3 text-right">
        <button className="btn-text mr-3" onClick={onDelete}>
          Cancel
        </button>
        <button
          className="btn-primary px-3 py-1.5 text-xs"
          onClick={() => {
            onSave({ name, durationMin: duration, priceAed: price, vatInclusive });
            setEditing(false);
          }}
        >
          Save
        </button>
      </td>
    </tr>
  );
}
