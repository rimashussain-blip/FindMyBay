// Layout for platform super-admin pages. Reuses the cream/mint palette but
// has a distinct sidebar so admins can immediately tell they're not in a
// vendor-scoped view.

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';

export function PlatformLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const clear = useAuth((s) => s.clear);

  const handleLogout = () => {
    clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto flex max-w-[1400px]">
        <Sidebar onLogout={handleLogout} />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ onLogout }: { onLogout: () => void }) {
  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col gap-2 border-r border-mint-edge bg-white p-6">
      {/* Brand block */}
      <div className="mb-8 flex items-center gap-3">
        <LogoMark size={40} />
        <div>
          <div className="text-sm font-bold text-ink leading-tight">Find My Bay</div>
          <div className="text-[11px] uppercase tracking-wider text-coral">Platform</div>
        </div>
      </div>

      {/* Coral-tinted role chip — visually distinct from the sand vendor chip */}
      <div className="mb-6 rounded-xl border border-coral-soft bg-coral-soft/40 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-coral">Super admin</div>
        <div className="mt-0.5 text-sm font-bold text-ink">All vendors</div>
      </div>

      <nav className="flex flex-col gap-1">
        <NavItem to="/platform/vendors" label="Vendors" icon="🏪" />
        <NavItem to="/platform/vendors/new" label="Onboard vendor" icon="➕" />
        <NavItem to="/platform/users" label="App users" icon="👥" />
        <div className="pointer-events-none mt-2 flex items-center gap-3 rounded-full px-4 py-2.5 text-sm text-ink-soft opacity-50">
          <span>📊</span> Reports
          <span className="ml-auto rounded-full bg-mint-edge px-2 py-0.5 text-[10px] font-medium">
            soon
          </span>
        </div>
      </nav>

      <div className="mt-auto">
        <button
          onClick={onLogout}
          className="w-full rounded-full border border-mint-edge bg-white px-4 py-2.5 text-sm text-ink-soft hover:bg-mint"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

function NavItem({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition',
          isActive
            ? 'bg-primary-deep text-white'
            : 'text-ink hover:bg-mint hover:text-primary-deep',
        ].join(' ')
      }
    >
      <span>{icon}</span> {label}
    </NavLink>
  );
}

// Brand kit "M1 Marker": solid deep-teal squircle with a cream teardrop
// and a circular cutout. Matches Android launcher + Vendor admin Layout.
function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl"
      style={{
        width: size,
        height: size,
        background: '#0F766E',
        boxShadow: '0 6px 16px rgba(15,118,110,0.3)',
      }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 100 100" fill="none">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          fill="#FFF7EC"
          d="M50 14 C50 14 22 42 22 64 C22 79 34 90 50 90 C66 90 78 79 78 64 C78 42 50 14 50 14 Z M50 49 a13 13 0 1 0 0 26 a13 13 0 1 0 0 -26 Z"
        />
      </svg>
    </div>
  );
}
