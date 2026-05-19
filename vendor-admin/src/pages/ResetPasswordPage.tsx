// Second half of the password-reset flow. User lands here via the email
// link with /reset-password/:token. We never preview the token contents —
// we just send it back with the new password.
//
// On success the backend returns fresh access/refresh tokens (it sees the
// reset as proof of identity), so we drop the user straight into the app.

import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { completePasswordReset } from '../api/auth';
import { useAuth, type UserRole } from '../store/auth';
import { PasswordStrengthBar, scorePassword } from '../components/PasswordStrength';

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const score = useMemo(() => scorePassword(password), [password]);
  const mismatch = confirm.length > 0 && confirm !== password;
  const tooShort = password.length > 0 && password.length < 8;
  const canSubmit = password.length >= 8 && password === confirm && !submitting && score.level >= 2;

  if (!token) return <Navigate to="/login" replace />;

  async function submit() {
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await completePasswordReset({ token, newPassword: password });
      const role = result.user.role as UserRole;
      setSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: result.user.id,
        role,
      });
      navigate(role === 'admin' ? '/platform/vendors' : '/bays', { replace: true });
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
          <h1 className="text-2xl font-bold tracking-tight text-ink">Choose a new password</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Min 8 characters. Mix upper/lower case, numbers and symbols for the strongest password.
          </p>
        </div>

        <div className="card">
          <div className="flex flex-col gap-4">
            <div>
              <div className="label-eyebrow mb-1.5">New password</div>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                autoFocus
              />
              <PasswordStrengthBar password={password} />
              {tooShort && (
                <p className="mt-1 text-xs text-coral">Password must be at least 8 characters.</p>
              )}
            </div>

            <div>
              <div className="label-eyebrow mb-1.5">Confirm password</div>
              <input
                type="password"
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
              {mismatch && (
                <p className="mt-1 text-xs text-coral">Passwords don't match.</p>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral">{error}</div>
            )}

            <button onClick={submit} disabled={!canSubmit} className="btn-primary">
              {submitting ? 'Updating…' : 'Update password & sign in'}
            </button>

            <Link to="/login" className="text-center text-sm text-primary-deep hover:underline">
              Back to sign in
            </Link>
          </div>
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
