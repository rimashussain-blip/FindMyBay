// "Forgot your password?" — first half of the reset flow.
//
// We always show the success view after submit, regardless of whether the
// email exists. This matches the backend (which silently no-ops on unknown
// emails) and avoids leaking account existence to a scraper.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../api/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setSent(true);
    } catch (e: unknown) {
      setError(extractError(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="halo-mint pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {sent ? 'Check your inbox' : 'Reset your password'}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {sent
              ? `If an account exists for ${email}, we sent a link to reset your password. The link works once and expires in 1 hour.`
              : 'Enter your email and we\'ll send you a one-time link to set a new password.'}
          </p>
        </div>

        <div className="card">
          {!sent ? (
            <div className="flex flex-col gap-4">
              <div>
                <div className="label-eyebrow mb-1.5">Email</div>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@business.ae"
                  autoComplete="email"
                  autoFocus
                />
              </div>
              {error && (
                <div className="rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral">{error}</div>
              )}
              <button
                className="btn-primary"
                onClick={submit}
                disabled={!email || submitting}
              >
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
              <Link to="/login" className="text-center text-sm text-primary-deep hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink-soft">
                Didn't get an email? Check your spam folder, or{' '}
                <button
                  onClick={() => setSent(false)}
                  className="text-primary-deep underline hover:no-underline"
                >
                  try a different email
                </button>
                .
              </p>
              <Link to="/login" className="btn-outlined text-center">
                Back to sign in
              </Link>
            </div>
          )}
        </div>
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
