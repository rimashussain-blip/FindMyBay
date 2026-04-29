import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../api/auth';
import { useAuth, type UserRole } from '../store/auth';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('polaris@findmybay.ae');
  const [password, setPassword] = useState('fmb-demo-2026');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useAuth((s) => s.setSession);
  const navigate = useNavigate();

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
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        userId: res.user.id,
        role,
      });
      // Platform admins land on the vendor approval queue; vendor staff go
      // to their bay board as before.
      navigate(role === 'admin' ? '/platform/vendors' : '/bays', { replace: true });
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
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(160deg, #2DD4BF 0%, #0F766E 100%)' }}
          >
            <svg width="32" height="32" viewBox="0 0 100 100">
              <path
                d="M50 18 C50 18 28 42 28 60 C28 72 38 82 50 82 C62 82 72 72 72 60 C72 42 50 18 50 18 Z"
                fill="#fff"
              />
              <text
                x="50"
                y="69"
                textAnchor="middle"
                fontFamily="Roboto"
                fontWeight="700"
                fontSize="28"
                fill="#0F766E"
                letterSpacing="-1"
              >
                P
              </text>
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
                <p className="mt-1.5 text-xs text-ink-soft">
                  At least 8 characters. We hash your password with bcrypt before storing.
                </p>
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

            {mode === 'login' && (
              <div className="rounded-lg bg-mint px-3 py-2 text-[11px] text-primary-deep">
                <strong className="font-bold">Demo accounts:</strong>{' '}
                <code className="rounded bg-white px-1.5 py-0.5">polaris@findmybay.ae</code>
                {' or '}
                <code className="rounded bg-white px-1.5 py-0.5">marina@findmybay.ae</code>
                {' · password '}
                <code className="rounded bg-white px-1.5 py-0.5">fmb-demo-2026</code>
              </div>
            )}
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
