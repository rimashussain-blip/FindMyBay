// Self-heals stale auth sessions.
//
// Persisted localStorage from before role-aware routing has accessToken but
// no role. Without this hook, the user lands on the vendor area, the page
// 403s against /admin/me, and they get the "Couldn't load bays" wall.
// On mount: if we have a token but no role, fetch /auth/me. If it returns,
// populate the role and let the router re-render. If it 401s (token expired
// or invalidated), clear the session.

import { useEffect, useState } from 'react';
import { getCurrentUser } from '../api/auth';
import { useAuth, type UserRole } from '../store/auth';

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const accessToken = useAuth((s) => s.accessToken);
  const refreshToken = useAuth((s) => s.refreshToken);
  const userId = useAuth((s) => s.userId);
  const role = useAuth((s) => s.role);
  const setSession = useAuth((s) => s.setSession);
  const clear = useAuth((s) => s.clear);

  const needsHydration = !!accessToken && !role;
  const [hydrating, setHydrating] = useState(needsHydration);

  useEffect(() => {
    if (!needsHydration) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await getCurrentUser();
        if (cancelled) return;
        if (!accessToken || !refreshToken || !userId) {
          // Session was cleared mid-flight — bail out without writing.
          return;
        }
        setSession({
          accessToken,
          refreshToken,
          userId: me.id,
          role: me.role as UserRole,
        });
      } catch {
        // 401 → axios interceptor already cleared the session. Anything else,
        // we still drop the session so we don't loop forever on a bad token.
        if (!cancelled) clear();
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsHydration]);

  if (hydrating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream text-sm text-ink-soft">
        Loading your account…
      </div>
    );
  }
  return <>{children}</>;
}
