import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getMe } from '../api/admin';
import { useAuth } from '../store/auth';
import { VerifyEmailBanner } from './VerifyEmailBanner';

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
        <main className="flex-1 p-8">
          <VerifyEmailBanner />
          {children}
        </main>
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
    <aside className="sticky top-0 flex h-screen w-[280px] flex-col gap-3.5 border-r border-mint-edge bg-white p-6">
      {/* Brand block */}
      <div className="flex items-center gap-3 px-2.5 py-1.5">
        <LogoMark size={44} />
        <div className="leading-tight">
          <div className="text-[17px] font-extrabold tracking-tight text-ink">findMy Bay</div>
          <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary-deep">
            Vendor
          </div>
        </div>
      </div>

      {/* Owner chip — warm sand gradient, matches the loyalty card on the app */}
      <div
        className="mt-1.5 rounded-2xl border px-4 py-3.5"
        style={{
          backgroundImage: 'linear-gradient(135deg, #FBF1DF, #FCE7C8)',
          borderColor: 'rgba(245, 199, 126, 0.45)',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#7a4d12]">
            {role ?? '…'}
          </div>
          {status && status !== 'active' && <StatusPill status={status} />}
        </div>
        <div className="mt-0.5 text-base font-bold text-ink">{brandName ?? 'Loading…'}</div>
      </div>

      {/* Nav */}
      <nav className="mt-1.5 flex flex-col gap-1">
        <NavItem to="/dashboard" label="Dashboard" icon={<DashboardIcon />} />
        <NavItem to="/bays" label="Bay board" icon={<BayBoardIcon />} />
        <NavItem to="/bookings" label="Bookings" icon={<BookingsIcon />} />
        <NavItem to="/walk-in" label="Walk-in" icon={<WalkInIcon />} />
        <NavItem to="/scan" label="Scan check-in" icon={<ScanIcon />} />
        <NavItem to="/services" label="Services" icon={<ServicesIcon />} />
        <NavItem to="/promotions" label="Promotions" icon={<PromotionsIcon />} />
        <NavItem to="/finance" label="Finance" icon={<FinanceIcon />} />
        <NavItem to="/inventory" label="Inventory" icon={<InventoryIcon />} />
        <NavItem to="/procurement" label="Procurement" icon={<ProcurementIcon />} />
        <NavItem to="/loyalty" label="Loyalty" icon={<LoyaltyIcon />} />
        <NavItem to="/staff" label="Staff" icon={<StaffIcon />} />
        <NavItem to="/reviews" label="Reviews" icon={<ReviewsIcon />} />
        <NavItem to="/brand" label="Brand & branch" icon={<BrandIcon />} />
      </nav>

      <div className="mt-auto">
        <button
          onClick={onLogout}
          className="w-full rounded-xl border border-mint-edge bg-white px-4 py-3 text-[13px] font-semibold text-ink-soft transition hover:bg-mint hover:text-ink"
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

function NavItem({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          // 12px rounded pill per design; active gets the aqua→deep gradient
          // with a soft drop-shadow so it lifts off the white sidebar.
          'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition',
          isActive
            ? 'text-white shadow-md shadow-primary-deep/30'
            : 'text-ink-soft hover:bg-mint hover:text-ink',
        ].join(' ')
      }
      style={({ isActive }) =>
        isActive
          ? { backgroundImage: 'linear-gradient(135deg, #14B8A6, #0F766E)' }
          : undefined
      }
    >
      <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">
        {icon}
      </span>
      {label}
    </NavLink>
  );
}

function LogoMark({ size = 44 }: { size?: number }) {
  // Brand kit "M1 Marker": solid deep-teal squircle with a cream teardrop
  // and a circular cutout through its centre. Matches the Android adaptive
  // launcher + in-app LogoMark composable.
  return (
    <div
      className="flex items-center justify-center rounded-xl"
      style={{
        width: size,
        height: size,
        background: '#0F766E',
        boxShadow: '0 6px 16px rgba(15,118,110,0.30)',
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

// ─── Nav icons (vector, matches the design handoff) ──────────────────────

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="6" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="2" y="13" width="6" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10" y="2" width="6" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10" y="7" width="6" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function BayBoardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2.5" y="2.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 6.5h13" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="11" r="1.5" fill="currentColor" />
    </svg>
  );
}

function BookingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2.5" y="4" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M2.5 7.5h13M6 2v4M12 2v4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WalkInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="4" r="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M9 6v4m-3 6l3-6 3 6M5 9l4-1 4 1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ServicesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M9 2l1.8 3.8 4.2.6-3 3 .8 4.2L9 11.5l-3.8 2.1.8-4.2-3-3 4.2-.6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReviewsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M9 2l2 4 4.5.5L12 10l1 4.5L9 12 5 14.5l1-4.5-3.5-3.5L7 6z"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BrandIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PromotionsIcon() {
  // Gift / tag glyph
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12v10H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function ProcurementIcon() {
  // Truck / delivery glyph — suppliers + POs
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 3h15v13H1z" />
      <path d="M16 8h4l3 3v5h-7" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function LoyaltyIcon() {
  // Award / medal glyph
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M8.21 13.89 7 22l5-3 5 3-1.21-8.12" />
    </svg>
  );
}

function InventoryIcon() {
  // Boxes / stacked crates glyph
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </svg>
  );
}

function FinanceIcon() {
  // Coin / receipt glyph
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h12l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" />
      <path d="M16 4v4h4" />
      <path d="M8 13h8M8 17h5" />
      <path d="M10 9h2" />
    </svg>
  );
}

function StaffIcon() {
  // Two-people / team glyph
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
