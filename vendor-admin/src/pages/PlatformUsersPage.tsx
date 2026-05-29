// Platform super-admin: every customer (app user) on the system. Searchable
// by name / email / phone / plate / make. Click a row to drill into profile +
// booking history. Read-only for V1 — no suspend/edit yet.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { listPlatformUsers, type PlatformUser } from '../api/platform';

const PAGE_SIZE = 50;

export default function PlatformUsersPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['platform', 'users', q, page],
    queryFn: () => listPlatformUsers({ q: q || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const showingFrom = items.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = page * PAGE_SIZE + items.length;
  const hasMore = showingTo < total;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="label-eyebrow mb-1">Platform</div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">App users</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {total} total customer{total === 1 ? '' : 's'}.
          </p>
        </div>
        <div className="w-72">
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Search name, email, phone, plate…"
            className="w-full rounded-full border border-mint-edge bg-white px-4 py-2 text-sm text-ink placeholder:text-ink-soft focus:border-primary-deep focus:outline-none"
          />
        </div>
      </header>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-mint">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-primary-deep">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Car</th>
              <th className="px-4 py-3 text-right">Bookings</th>
              <th className="px-4 py-3">Profile</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-ink-soft">
                  Loading users…
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-ink-soft">
                  {q ? `No users matching "${q}".` : 'No users yet.'}
                </td>
              </tr>
            )}
            {items.map((u) => (
              <UserRow key={u.id} u={u} />
            ))}
          </tbody>
        </table>
      </div>

      {(showingTo > 0 || hasMore || page > 0) && (
        <div className="flex items-center justify-between text-xs text-ink-soft">
          <div>
            Showing {showingFrom}–{showingTo} of {total}
            {isFetching && <span className="ml-2 italic">refreshing…</span>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isFetching}
              className="rounded-full border border-mint-edge bg-white px-3 py-1.5 font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore || isFetching}
              className="rounded-full border border-mint-edge bg-white px-3 py-1.5 font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserRow({ u }: { u: PlatformUser }) {
  return (
    <tr className="border-t border-mint-edge align-top hover:bg-mint/30">
      <td className="px-4 py-3">
        <Link
          to={`/platform/users/${u.id}`}
          className="font-semibold text-ink hover:text-primary-deep hover:underline"
        >
          {u.fullName ?? '—'}
        </Link>
      </td>
      <td className="px-4 py-3">
        <div className="text-ink">{u.email ?? '—'}</div>
        <div className="text-[11px] text-ink-soft">{u.phone ?? '—'}</div>
      </td>
      <td className="px-4 py-3">
        <div className="text-ink">
          {[u.carColor, u.carMake].filter(Boolean).join(' ') || '—'}
          {u.carType && (
            <span className="ml-1 text-[11px] text-ink-soft">· {u.carType}</span>
          )}
        </div>
        <div className="text-[11px] text-ink-soft">{u.carPlate ?? '—'}</div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{u.bookingCount}</td>
      <td className="px-4 py-3">
        <ProfilePill complete={u.profileComplete} />
      </td>
      <td className="px-4 py-3 text-[11px] text-ink-soft">{formatDate(u.createdAt)}</td>
    </tr>
  );
}

function ProfilePill({ complete }: { complete: boolean }) {
  return (
    <span
      className={[
        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        complete ? 'bg-mint text-primary-deep' : 'bg-amber/30 text-ink',
      ].join(' ')}
    >
      {complete ? 'Complete' : 'Partial'}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
