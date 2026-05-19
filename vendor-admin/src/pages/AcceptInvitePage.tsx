// Accept a staff invite token. Public page (no Protected wrap) — but the
// accept endpoint needs a signed-in user, so we bounce to /login if there's
// no token, preserving the invite URL in `returnTo` so we land back here.
//
// Flow:
//   1. Page loads → fetch invite preview (vendor brand + role + expiry).
//   2. If not signed in → show "Sign in to accept" CTA → navigate to
//      /login?returnTo=/accept-invite/:token.
//   3. If signed in → show vendor card + "Accept invite" button.
//   4. On accept → navigate to /bays so the new member sees their new vendor.

import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { acceptInvite, previewInvite } from '../api/staff';
import { useAuth } from '../store/auth';

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const accessToken = useAuth((s) => s.accessToken);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: invite, isLoading, error: previewError } = useQuery({
    queryKey: ['invite-preview', token],
    queryFn: () => previewInvite(token!),
    enabled: !!token,
    retry: false,
  });

  // No token in the URL — just bounce home.
  if (!token) return <Navigate to="/" replace />;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="halo-mint pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(160deg, #2DD4BF 0%, #0F766E 100%)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <path d="M20 8v6M23 11h-6" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Staff invite</h1>
        </div>

        <div className="card flex flex-col gap-4">
          {isLoading && (
            <div className="text-sm text-ink-soft text-center py-4">Loading invite…</div>
          )}

          {previewError && (
            <div className="rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral">
              {extractError(previewError)}
            </div>
          )}

          {invite && (
            <>
              <div className="rounded-xl border border-mint-edge bg-mint/30 p-4">
                <div className="label-eyebrow mb-1">You've been invited to join</div>
                <div className="text-lg font-bold text-ink">{invite.vendor.brandName}</div>
                <div className="text-xs text-ink-soft mt-0.5">
                  {invite.vendor.city}, {prettyEmirate(invite.vendor.emirate)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Role" value={cap(invite.role)} />
                <Field
                  label="Expires"
                  value={new Date(invite.expiresAt).toLocaleDateString('en-AE', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                />
              </div>

              <div className="text-xs text-ink-soft">
                Invited as <span className="font-semibold text-ink">{invite.email}</span>.
              </div>

              {invite.status !== 'pending' && (
                <div className="rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral">
                  This invite is {invite.status}. Ask the owner to send a new one.
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral">{error}</div>
              )}

              {invite.status === 'pending' && (
                <>
                  {accessToken ? (
                    <button
                      className="btn-primary"
                      onClick={async () => {
                        setError(null);
                        setAccepting(true);
                        try {
                          await acceptInvite(token);
                          navigate('/bays', { replace: true });
                        } catch (e) {
                          setError(extractError(e));
                        } finally {
                          setAccepting(false);
                        }
                      }}
                      disabled={accepting}
                    >
                      {accepting ? 'Joining team…' : `Accept and join ${invite.vendor.brandName}`}
                    </button>
                  ) : (
                    <button
                      className="btn-primary"
                      onClick={() =>
                        navigate(`/login?returnTo=${encodeURIComponent(`/accept-invite/${token}`)}`)
                      }
                    >
                      Sign in to accept
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-ink-soft">
          Trouble joining? Ask the owner of {invite?.vendor.brandName ?? 'the team'} to resend the
          invite.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-mint-edge bg-white p-3">
      <div className="label-eyebrow mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function prettyEmirate(e: string): string {
  // Schema enum is camelCase ('AbuDhabi'); show 'Abu Dhabi' style.
  return e.replace(/([A-Z])/g, ' $1').trim();
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } }).response;
    return resp?.data?.error?.message ?? 'Request failed';
  }
  return e instanceof Error ? e.message : 'Request failed';
}
