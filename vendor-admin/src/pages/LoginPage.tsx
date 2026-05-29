import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { login, register } from '../api/auth';
import { useAuth, type UserRole } from '../store/auth';
import { PasswordStrengthBar } from '../components/PasswordStrength';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useAuth((s) => s.setSession);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // If a staff invite redirected here, send the user back to /accept-invite/...
  // after sign-in so they can complete acceptance without re-pasting the URL.
  const returnTo = searchParams.get('returnTo');

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await login(email.trim().toLowerCase(), password)
        : await register({
            email: email.trim().toLowerCase(),
            password,
            fullName: fullName.trim() || undefined,
          });
      const role = res.user.role as UserRole;
      const mustChange = res.user.mustChangePassword ?? false;
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        userId: res.user.id,
        role,
        mustChangePassword: mustChange,
      });
      // Staff created with a temp password must set their own first.
      if (mustChange) {
        navigate('/set-password', { replace: true });
      } else if (returnTo && returnTo.startsWith('/')) {
        // Honor ?returnTo= (staff-invite flow). Only same-origin paths.
        navigate(returnTo, { replace: true });
      } else {
        // Platform admins land on the vendor approval queue; vendor staff go
        // to their bay board as before.
        navigate(role === 'admin' ? '/platform/vendors' : '/bays', { replace: true });
      }
    } catch (e: unknown) {
      setError(extractError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cream px-4">
      {/* Soft cream → mint halo behind the card */}
      <div className="halo-mint pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          {/* Brand mark per brand kit "M1 Marker": solid deep-teal squircle
              with a cream teardrop and a circular cutout. Matches the Android
              launcher icon + the in-app LogoMark composable. */}
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
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {mode === 'login' ? 'Vendor sign in' : 'Create vendor account'}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {mode === 'login'
              ? 'Sign in to manage your bays and bookings.'
              : 'Sign up to list your car wash on Find My Bay.'}
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex rounded-full border border-mint-edge bg-white p-1">
          <TabButton
            label="Sign in"
            active={mode === 'login'}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          />
          <TabButton
            label="Create account"
            active={mode === 'register'}
            onClick={() => {
              setMode('register');
              setError(null);
            }}
          />
        </div>

        <div className="card">
          <div className="flex flex-col gap-4">
            {mode === 'register' && (
              <div>
                <div className="label-eyebrow mb-1.5">Your name</div>
                <input
                  className="input"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Sara Hassan"
                />
              </div>
            )}

            <div>
              <div className="label-eyebrow mb-1.5">Email</div>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.ae"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="label-eyebrow mb-1.5">Password</div>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              {mode === 'register' && (
                <>
                  <PasswordStrengthBar password={password} />
                  <p className="mt-1.5 text-xs text-ink-soft">
                    At least 8 characters. We hash your password with bcrypt before storing.
                  </p>
                </>
              )}
              {mode === 'login' && (
                <div className="mt-1.5 text-right">
                  <Link
                    to="/forgot-password"
                    className="text-xs text-primary-deep hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral">{error}</div>
            )}

            <button
              className="btn-primary"
              onClick={submit}
              disabled={loading || !email || password.length < 1}
            >
              {loading
                ? mode === 'login'
                  ? 'Signing in…'
                  : 'Creating account…'
                : mode === 'login'
                  ? 'Sign in'
                  : 'Create account'}
            </button>

          </div>
        </div>

        <p className="mt-6 text-center text-xs text-ink-soft">
          By continuing you agree to the{' '}
          <a className="text-primary-deep hover:underline">Terms</a> &{' '}
          <a className="text-primary-deep hover:underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex-1 rounded-full py-2 text-sm font-medium transition',
        active ? 'bg-primary-deep text-white' : 'text-ink-soft hover:text-ink',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } }).response;
    return resp?.data?.error?.message ?? 'Request failed';
  }
  return e instanceof Error ? e.message : 'Request failed';
}
