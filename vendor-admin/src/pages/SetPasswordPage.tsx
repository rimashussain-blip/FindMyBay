// Forced first-login password change for staff created with a temporary
// password (mustChangePassword). Reached from LoginPage after sign-in and
// enforced by the route guards in App.tsx until the new password is set.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../api/auth';
import { useAuth } from '../store/auth';
import { PasswordStrengthBar } from '../components/PasswordStrength';

export default function SetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const clearMustChange = useAuth((s) => s.clearMustChange);
  const role = useAuth((s) => s.role);

  async function submit() {
    setError(null);
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await changePassword(password);
      clearMustChange();
      navigate(role === 'admin' ? '/platform/vendors' : '/', { replace: true });
    } catch (e) {
      setError(extractError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="halo-mint pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: '#0F766E' }}
          >
            <svg width="34" height="34" viewBox="0 0 100 100" fill="none">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                fill="#FFF7EC"
                d="M50 14 C50 14 22 42 22 64 C22 79 34 90 50 90 C66 90 78 79 78 64 C78 42 50 14 50 14 Z M50 49 a13 13 0 1 0 0 26 a13 13 0 1 0 0 -26 Z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Set a new password</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Your account was created with a temporary password. Choose your own to continue.
          </p>
        </div>

        <div className="card">
          <div className="flex flex-col gap-4">
            <div>
              <div className="label-eyebrow mb-1.5">New password</div>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                autoFocus
              />
              <PasswordStrengthBar password={password} />
            </div>
            <div>
              <div className="label-eyebrow mb-1.5">Confirm password</div>
              <input
                className="input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral">{error}</div>
            )}

            <button
              className="btn-primary"
              onClick={submit}
              disabled={loading || password.length < 1 || confirm.length < 1}
            >
              {loading ? 'Saving…' : 'Save and continue'}
            </button>
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
