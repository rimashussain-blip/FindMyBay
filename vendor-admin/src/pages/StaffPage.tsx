// Vendor admin → Staff management.
//
// Matches Batch C — Staff (Find My Bay design handoff):
// - Members table with role chips, status chips, last-seen, and actions.
// - Pending invites list with copy-URL + resend + revoke actions.
// - Invite modal: 2-step (email + role → success with copy URL).
// - Owner-only mutations gated on the client too; backend re-checks anyway.
//
// V1 quirk: backend doesn't send invite emails yet (Batch D). The owner copies
// the accept URL from the invite card and shares it manually.

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptInvite as _acceptInvite, // unused here; imported by AcceptInvitePage
  changeRole,
  inviteStaff,
  listStaff,
  reactivateStaff,
  removeStaff,
  resendInvite,
  revokeInvite,
  suspendStaff,
  type AddStaffResult,
  type StaffInvite,
  type StaffMember,
  type StaffRole,
} from '../api/staff';
import { getMe } from '../api/admin';
import { useAuth } from '../store/auth';

void _acceptInvite; // keep import used; reduces lint noise

export default function StaffPage() {
  const qc = useQueryClient();
  const myUserId = useAuth((s) => s.userId);
  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe });
  const myRole = (meQ.data?.role ?? '').toLowerCase();
  // Only `owner` can mutate staff (matches backend's requireVendor('owner')).
  const isOwner = myRole === 'owner';

  const { data, isLoading, error } = useQuery({ queryKey: ['staff'], queryFn: listStaff });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<StaffMember | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="label-eyebrow mb-1">Team</div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Staff</h1>
          <p className="mt-1 text-sm text-ink-soft max-w-[620px]">
            Invite teammates, assign roles, and control who can manage bookings,
            finance, and settings. Owners can do everything; managers handle
            day-to-day operations; attendants run the bay board.
          </p>
        </div>
        {isOwner && (
          <button onClick={() => setInviteOpen(true)} className="btn-primary">
            + Invite teammate
          </button>
        )}
      </header>

      <RoleCheatSheet />

      {isLoading && <CardSkeleton />}
      {error && (
        <div className="rounded-xl bg-coral-soft text-coral p-4 text-sm">
          Couldn't load staff. Try refreshing.
        </div>
      )}

      {data && (
        <>
          <section>
            <h2 className="text-lg font-bold text-ink mb-3">
              Members <span className="text-ink-soft font-medium">({data.members.length})</span>
            </h2>
            <div className="rounded-2xl border border-mint-edge bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-mint/40 text-left text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mint-edge">
                  {data.members.map((m) => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      isOwner={isOwner}
                      isSelf={m.userId === myUserId}
                      onChangeRole={async (role) => {
                        try {
                          await changeRole(m.userId, role);
                          qc.invalidateQueries({ queryKey: ['staff'] });
                        } catch (e) {
                          alert(extractError(e));
                        }
                      }}
                      onSuspend={async () => {
                        try {
                          await suspendStaff(m.userId);
                          qc.invalidateQueries({ queryKey: ['staff'] });
                        } catch (e) {
                          alert(extractError(e));
                        }
                      }}
                      onReactivate={async () => {
                        try {
                          await reactivateStaff(m.userId);
                          qc.invalidateQueries({ queryKey: ['staff'] });
                        } catch (e) {
                          alert(extractError(e));
                        }
                      }}
                      onRemove={() => setRemoveTarget(m)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink mb-3">
              Pending invites{' '}
              <span className="text-ink-soft font-medium">({data.invites.length})</span>
            </h2>
            {data.invites.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-mint-edge bg-white/60 p-6 text-sm text-ink-soft text-center">
                No pending invites. {isOwner && 'Use "Invite teammate" to add someone.'}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {data.invites.map((inv) => (
                  <InviteCard
                    key={inv.id}
                    invite={inv}
                    isOwner={isOwner}
                    onResend={async () => {
                      try {
                        const updated = await resendInvite(inv.id);
                        await navigator.clipboard.writeText(updated.acceptUrl);
                        alert('Invite extended and URL copied to clipboard.');
                        qc.invalidateQueries({ queryKey: ['staff'] });
                      } catch (e) {
                        alert(extractError(e));
                      }
                    }}
                    onRevoke={async () => {
                      if (!confirm(`Revoke invite for ${inv.email}?`)) return;
                      try {
                        await revokeInvite(inv.id);
                        qc.invalidateQueries({ queryKey: ['staff'] });
                      } catch (e) {
                        alert(extractError(e));
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['staff'] });
          }}
        />
      )}

      {removeTarget && (
        <RemoveModal
          member={removeTarget}
          onClose={() => setRemoveTarget(null)}
          onConfirm={async () => {
            try {
              await removeStaff(removeTarget.userId);
              setRemoveTarget(null);
              qc.invalidateQueries({ queryKey: ['staff'] });
            } catch (e) {
              alert(extractError(e));
            }
          }}
        />
      )}
    </div>
  );
}

// ── Member row ───────────────────────────────────────────────────────────

function MemberRow({
  member,
  isOwner,
  isSelf,
  onChangeRole,
  onSuspend,
  onReactivate,
  onRemove,
}: {
  member: StaffMember;
  isOwner: boolean;
  isSelf: boolean;
  onChangeRole: (role: StaffRole) => void | Promise<void>;
  onSuspend: () => void | Promise<void>;
  onReactivate: () => void | Promise<void>;
  onRemove: () => void;
}) {
  const joined = useMemo(
    () => new Date(member.joinedAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' }),
    [member.joinedAt],
  );

  return (
    <tr className="hover:bg-mint/20">
      <td className="px-4 py-3">
        <div className="font-semibold text-ink">{member.name}</div>
        <div className="text-xs text-ink-soft">{member.email ?? member.phone ?? '—'}</div>
      </td>
      <td className="px-4 py-3">
        {isOwner && !isSelf ? (
          <select
            className="rounded-lg border border-mint-edge bg-white px-2 py-1 text-xs font-semibold capitalize text-ink"
            value={member.role}
            onChange={(e) => onChangeRole(e.target.value as StaffRole)}
          >
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="attendant">Attendant</option>
          </select>
        ) : (
          <RoleChip role={member.role} />
        )}
      </td>
      <td className="px-4 py-3">
        <StatusChip status={member.status} />
      </td>
      <td className="px-4 py-3 text-ink-soft">{joined}</td>
      <td className="px-4 py-3 text-right">
        {!isOwner || isSelf ? (
          <span className="text-xs text-ink-soft">{isSelf ? '(you)' : '—'}</span>
        ) : member.status === 'active' ? (
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => onSuspend()}
              className="rounded-lg border border-mint-edge px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-mint hover:text-ink"
            >
              Suspend
            </button>
            <button
              onClick={() => onRemove()}
              className="rounded-lg bg-coral-soft px-3 py-1.5 text-xs font-semibold text-coral hover:bg-coral hover:text-white"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => onReactivate()}
              className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-primary-deep hover:bg-primary hover:text-white"
            >
              Reactivate
            </button>
            <button
              onClick={() => onRemove()}
              className="rounded-lg bg-coral-soft px-3 py-1.5 text-xs font-semibold text-coral hover:bg-coral hover:text-white"
            >
              Remove
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Invite card ──────────────────────────────────────────────────────────

function InviteCard({
  invite,
  isOwner,
  onResend,
  onRevoke,
}: {
  invite: StaffInvite;
  isOwner: boolean;
  onResend: () => void;
  onRevoke: () => void;
}) {
  const expiresIn = useMemo(() => {
    const days = Math.max(0, Math.ceil((new Date(invite.expiresAt).getTime() - Date.now()) / 86_400_000));
    return days === 1 ? '1 day' : `${days} days`;
  }, [invite.expiresAt]);

  return (
    <div
      className="rounded-2xl border-[1.5px] border-primary/70 bg-white overflow-hidden"
      style={{
        boxShadow: '0 4px 14px rgba(15,118,110,0.08)',
      }}
    >
      <div
        className="px-5 py-3 flex items-center gap-3"
        style={{ backgroundImage: 'linear-gradient(135deg, #E6F7F4, #FCE7C8)' }}
      >
        <div className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-deep">
          Pending invite
        </div>
        <div className="ml-auto text-[11px] font-semibold text-ink-soft">
          Expires in {expiresIn}
        </div>
      </div>
      <div className="px-5 py-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px]">
          <div className="font-semibold text-ink">{invite.email}</div>
          <div className="mt-1 flex items-center gap-2">
            <RoleChip role={invite.role} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(invite.acceptUrl);
              alert('Accept URL copied to clipboard. Share it with your teammate.');
            }}
            className="rounded-lg border border-mint-edge bg-white px-3 py-1.5 text-xs font-semibold text-primary-deep hover:bg-mint"
          >
            Copy URL
          </button>
          {isOwner && (
            <>
              <button
                onClick={onResend}
                className="rounded-lg border border-mint-edge bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-mint hover:text-ink"
              >
                Resend (extend 14d)
              </button>
              <button
                onClick={onRevoke}
                className="rounded-lg bg-coral-soft px-3 py-1.5 text-xs font-semibold text-coral hover:bg-coral hover:text-white"
              >
                Revoke
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Invite modal ─────────────────────────────────────────────────────────

function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('attendant');
  const [created, setCreated] = useState<AddStaffResult | null>(null);

  const mut = useMutation({
    mutationFn: () => inviteStaff({ email: email.trim().toLowerCase(), role }),
    onSuccess: (res) => {
      setCreated(res);
      onCreated();
    },
  });

  return (
    <ModalShell onClose={onClose} title={created ? 'Teammate added' : 'Add teammate'}>
      {!created ? (
        <div className="flex flex-col gap-4">
          <div>
            <div className="label-eyebrow mb-1.5">Email</div>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@yourbrand.ae"
              autoFocus
            />
          </div>
          <div>
            <div className="label-eyebrow mb-1.5">Role</div>
            <div className="grid grid-cols-3 gap-2">
              {(['owner', 'manager', 'attendant'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={[
                    'rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize transition',
                    role === r
                      ? 'border-primary bg-mint text-primary-deep'
                      : 'border-mint-edge bg-white text-ink-soft hover:bg-mint/30',
                  ].join(' ')}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              {ROLE_BLURB[role]}
            </p>
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
              disabled={!email || mut.isPending}
              className="btn-primary"
            >
              {mut.isPending ? 'Adding…' : 'Add teammate'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-soft">
            <span className="font-semibold text-ink">{created.email}</span> was added as a{' '}
            <span className="font-semibold text-ink capitalize">{created.role}</span>.
          </p>
          <div className="rounded-xl border border-mint-edge bg-mint/30 px-3 py-3 text-sm text-ink">
            We emailed them a <span className="font-semibold">temporary password</span>. They sign
            in (web or the attendant app) and are asked to set their own password on first login.
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="btn-primary">
              Done
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// ── Remove confirmation ──────────────────────────────────────────────────

function RemoveModal({
  member,
  onClose,
  onConfirm,
}: {
  member: StaffMember;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell onClose={onClose} title="Remove from team?">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-soft">
          <span className="font-semibold text-ink">{member.name}</span> will lose access to this
          vendor immediately. Their historical bookings stay; their VendorMember row is deleted.
          Re-invite them by email to bring them back.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-outlined">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Remove
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Modal shell ──────────────────────────────────────────────────────────

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-ink-soft hover:bg-mint hover:text-ink"
            aria-label="Close"
          >
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

// ── Cheat sheet ──────────────────────────────────────────────────────────

const ROLE_BLURB: Record<StaffRole, string> = {
  owner:
    'Full access. Manage staff, finance, promotions, branding, and the bay board. There must always be at least one active owner.',
  manager:
    'Day-to-day operations. Manage bookings, walk-ins, services, and the bay board. Cannot manage staff or finance.',
  attendant:
    'Bay-floor access. Scan check-ins and update bay status. Cannot create services, promotions, or manage other staff.',
};

function RoleCheatSheet() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {(['owner', 'manager', 'attendant'] as const).map((r) => (
        <div
          key={r}
          className="rounded-2xl border border-mint-edge bg-white p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <RoleChip role={r} />
          </div>
          <p className="text-xs text-ink-soft leading-relaxed">{ROLE_BLURB[r]}</p>
        </div>
      ))}
    </div>
  );
}

// ── Chips ────────────────────────────────────────────────────────────────

function RoleChip({ role }: { role: StaffRole }) {
  const palette: Record<StaffRole, string> = {
    owner: 'bg-primary text-white',
    manager: 'bg-mint text-primary-deep',
    attendant: 'bg-sand text-[#7a4d12]',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${palette[role]}`}>
      {role}
    </span>
  );
}

function StatusChip({ status }: { status: StaffMember['status'] }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-deep">
        <span className="h-1.5 w-1.5 rounded-full bg-primary-deep" />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-coral-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-coral">
      <span className="h-1.5 w-1.5 rounded-full bg-coral" />
      Suspended
    </span>
  );
}

// ── Misc ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-mint-edge bg-white p-6">
      <div className="h-6 w-1/3 animate-pulse rounded bg-mint/60" />
      <div className="mt-4 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-mint/40" />
        ))}
      </div>
    </div>
  );
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } }).response;
    return resp?.data?.error?.message ?? 'Request failed';
  }
  return e instanceof Error ? e.message : 'Request failed';
}
