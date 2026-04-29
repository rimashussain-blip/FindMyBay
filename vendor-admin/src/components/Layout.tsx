import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMe } from '../api/admin';
import { useAuth } from '../store/auth';

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ['me'], queryFn: getMe });
  const clear = useAuth((s) => s.clear);

  const handleLogout = () => {
    clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto flex max-w-[1400px]">
        <Sidebar
          brandName={data?.vendor.brandName}
          status={data?.vendor.status}
          role={data?.role}
          onLogout={handleLogout}
        />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({
  brandName,
  status,
  role,
  onLogout,
}: {
  brandName: string | undefined;
  status: string | undefined;
  role: string | undefined;
  onLogout: () => void;
}) {
  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col gap-2 border-r border-mint-edge bg-white p-6">
      {/* Brand block */}
      <div className="mb-8 flex items-center gap-3">
        <LogoMark size={40} />
        <div>
          <div className="text-sm font-bold text-ink leading-tight">Find My Bay</div>
          <div className="text-[11px] uppercase tracking-wider text-primary-deep">Vendor</div>
        </div>
      </div>

      {/* Brand name + role chip — sand-tinted to echo the loyalty card on Android */}
      <div
        className="mb-6 rounded-xl border border-mint-edge p-3"
        style={{ backgroundImage: 'linear-gradient(135deg, #FCE7C8 0%, #FFE3D9 100%)' }}
      >
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-primary-deep">
            {role ?? '…'}
          </div>
          {status && status !== 'active' && <StatusPill status={status} />}
        </div>
        <div className="mt-0.5 text-sm font-bold text-ink">{brandName ?? 'Loading…'}</div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        <NavItem to="/bays" label="Bay board" icon="🅱" />
        <NavItem to="/bookings" label="Bookings" icon="📅" />
        <NavItem to="/scan" label="Scan check-in" icon="📷" />
        <NavItem to="/services" label="Services" icon="✨" />
        <NavItem to="/reviews" label="Reviews" icon="⭐" />
        <NavItem to="/brand" label="Brand & branch" icon="🏷" />
        <div className="pointer-events-none mt-2 flex items-center gap-3 rounded-full px-4 py-2.5 text-sm text-ink-soft opacity-50">
          <span>📊</span> Analytics
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

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'pending'
      ? 'bg-amber/30 text-ink'
      : status === 'suspended'
        ? 'bg-coral-soft text-coral'
        : 'bg-mint text-primary-deep';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${tone}`}
    >
      {status}
    </span>
  );
}

function NavItem({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
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

function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(160deg, #2DD4BF 0%, #0F766E 100%)',
        boxShadow: '0 6px 16px rgba(15,118,110,0.3)',
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 100 100">
        <path
          d="M50 18 C50 18 28 42 28 60 C28 72 38 82 50 82 C62 82 72 72 72 60 C72 42 50 18 50 18 Z"
          fill="#FFFFFF"
        />
        <text
          x="50"
          y="69"
          textAnchor="middle"
          fontFamily="Roboto, system-ui"
          fontWeight="700"
          fontSize="28"
          fill="#0F766E"
          letterSpacing="-1"
        >
          P
        </text>
      </svg>
    </div>
  );
}
