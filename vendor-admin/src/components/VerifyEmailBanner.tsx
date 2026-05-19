// Sticky banner shown at the top of the vendor admin shell when the
// signed-in user hasn't verified their email yet. Hidden when:
//   - emailVerifiedAt is non-null
//   - the user has no email on file (phone-OTP-only customers)
//   - the user just dismissed it this session (sessionStorage flag)
//
// The banner offers a "Resend verification email" button that hits
// /auth/email/verify/send and shows a transient success state.

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getCurrentUser, sendEmailVerification } from '../api/auth';

const DISMISS_KEY = 'fmb-verify-banner-dismissed';

export function VerifyEmailBanner() {
  const { data: me } = useQuery({ queryKey: ['auth-me'], queryFn: getCurrentUser });
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === '1',
  );
  const [sent, setSent] = useState(false);

  const mut = useMutation({
    mutationFn: () => sendEmailVerification(),
    onSuccess: () => setSent(true),
  });

  // Bail conditions — keep the order cheap-to-evaluate.
  if (dismissed) return null;
  if (!me) return null;
  if (!me.email) return null; // phone-OTP user; no email to verify
  if (me.emailVerifiedAt) return null;

  return (
    <div
      className="rounded-2xl border-[1.5px] border-amber/60 overflow-hidden mb-5"
      style={{ boxShadow: '0 4px 14px rgba(245, 199, 126, 0.20)' }}
    >
      <div
        className="px-5 py-3 flex items-center gap-3 flex-wrap"
        style={{ backgroundImage: 'linear-gradient(135deg, #FBF1DF, #FCE7C8)' }}
      >
        <span
          className="rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{ color: '#7a4d12' }}
        >
          Verify your email
        </span>
        <span className="text-sm text-ink-soft flex-1 min-w-[200px]">
          {sent ? (
            <>
              We sent a fresh link to <span className="font-semibold text-ink">{me.email}</span>.
              Check your spam folder if it doesn't arrive in a minute.
            </>
          ) : (
            <>
              We sent a verification link to{' '}
              <span className="font-semibold text-ink">{me.email}</span>. Click it to confirm —
              receipts and booking updates land in your inbox after that.
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          {!sent && (
            <button
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
              className="rounded-lg border border-amber/70 bg-white px-3 py-1.5 text-xs font-semibold text-[#7a4d12] hover:bg-amber/20 disabled:opacity-50"
            >
              {mut.isPending ? 'Sending…' : 'Resend email'}
            </button>
          )}
          <button
            onClick={() => {
              sessionStorage.setItem(DISMISS_KEY, '1');
              setDismissed(true);
            }}
            className="text-ink-soft hover:text-ink"
            aria-label="Dismiss verification banner"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
