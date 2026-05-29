// Email-verification landing page. Hit via the link in the welcome email
// (/verify-email/:token). We POST the token immediately on mount — the
// user doesn't need to click anything else. Errors are shown inline with
// a Sign-in fallback link.

import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { verifyEmail } from '../api/auth';

type Status = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyEmail(token)
      .then((res) => {
        if (cancelled) return;
        setEmail(res.email);
        setStatus('success');
      })
      .catch((e) => {
        if (cancelled) return;
        setError(extractError(e));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="halo-mint pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative w-full max-w-md text-center">
        {status === 'loading' && (
          <>
            <div className="mb-3 text-lg font-bold text-ink">Verifying…</div>
            <div className="text-sm text-ink-soft">Hang on a moment.</div>
          </>
        )}

        {status === 'success' && (
          <>
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: 'linear-gradient(160deg, #2DD4BF 0%, #0F766E 100%)' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Email verified</h1>
            <p className="mt-2 text-sm text-ink-soft max-w-sm mx-auto">
              {email ? <><span className="font-semibold text-ink">{email}</span> is confirmed.</> : 'Your email is confirmed.'}
              {' '}Receipts and booking updates will land here from now on.
            </p>
            <Link to="/bays" className="btn-primary mt-6 inline-block">
              Go to bay board
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-coral-soft">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF8B6B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Verification failed</h1>
            <p className="mt-2 text-sm text-coral max-w-sm mx-auto">
              {error ?? "We couldn't verify this link."}
            </p>
            <p className="mt-3 text-sm text-ink-soft max-w-sm mx-auto">
              Sign in and click "Resend verification email" from the banner at the top of your dashboard.
            </p>
            <Link to="/login" className="btn-primary mt-6 inline-block">
              Sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } }).response;
    return resp?.data?.error?.message ?? 'Verification failed.';
  }
  return e instanceof Error ? e.message : 'Verification failed.';
}
