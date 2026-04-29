// Find My Bay — Android (Material 3) screens
// Material You expressive flavor on the warm aqua brand palette.

const fmb = {
  primary: '#14B8A6',
  primaryDeep: '#0F766E',
  ink: '#0B3B36',
  inkSoft: '#3F6B65',
  cream: '#FFF7EC',
  sand: '#FCE7C8',
  sandDeep: '#F5C77E',
  mint: '#E6F7F4',
  mintEdge: '#CDEEE8',
  coral: '#FF8B6B',
  coralSoft: '#FFE3D9',
  white: '#FFFFFF',
  hairline: 'rgba(11,59,54,0.08)',
};

const ROBOTO = 'Roboto, "Google Sans", "Helvetica Neue", system-ui, sans-serif';

// ─────────────────────────────────────────────────────────────
// Status bar — Android
// ─────────────────────────────────────────────────────────────
function AStatusBar({ dark = false, time = '9:30' }) {
  const c = dark ? '#FFFFFF' : fmb.ink;
  return (
    <div style={{
      height: 32, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 18px',
      position: 'relative', zIndex: 5, fontFamily: ROBOTO,
    }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: c, letterSpacing: 0.2 }}>{time}</span>
      {/* punch hole */}
      <div style={{
        position: 'absolute', left: '50%', top: 6, transform: 'translateX(-50%)',
        width: 18, height: 18, borderRadius: '50%', background: '#000',
      }}/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="14" height="11" viewBox="0 0 16 13"><path d="M8 11.5L.5 5a10 10 0 0115 0L8 11.5z" fill={c}/></svg>
        <svg width="13" height="11" viewBox="0 0 14 13"><path d="M13 12V1L1 12h12z" fill={c}/></svg>
        <svg width="20" height="11" viewBox="0 0 22 13"><rect x="0.5" y="2" width="18" height="9" rx="1.5" fill="none" stroke={c} strokeWidth="1"/><rect x="2" y="3.5" width="13" height="6" rx="0.5" fill={c}/><rect x="19" y="4" width="2" height="5" rx="0.5" fill={c}/></svg>
      </div>
    </div>
  );
}

// gesture nav handle
function AGestureBar({ dark = false }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 22,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8,
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 108, height: 4, borderRadius: 2,
        background: dark ? 'rgba(255,255,255,0.85)' : 'rgba(11,59,54,0.45)',
      }}/>
    </div>
  );
}

// Android phone shell
function APhone({ children, dark = false, bg }) {
  return (
    <div style={{
      width: 320, height: 660, borderRadius: 36, overflow: 'hidden',
      position: 'relative', background: bg || (dark ? '#0B3B36' : fmb.cream),
      boxShadow: '0 30px 60px rgba(11,59,54,0.18), 0 0 0 1px rgba(11,59,54,0.06)',
      fontFamily: ROBOTO, WebkitFontSmoothing: 'antialiased', color: fmb.ink,
    }}>
      <AStatusBar dark={dark}/>
      <div style={{ height: 'calc(100% - 32px)', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      <AGestureBar dark={dark}/>
    </div>
  );
}

// Material 3 top app bar
function ATopBar({ title, leading = 'back', trailing, large = false, surface }) {
  const Ico = ({ k }) => {
    if (k === 'back') return <svg width="20" height="20" viewBox="0 0 20 20"><path d="M13 4l-6 6 6 6" stroke={fmb.ink} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    if (k === 'menu') return <svg width="20" height="20" viewBox="0 0 20 20"><path d="M3 5h14M3 10h14M3 15h14" stroke={fmb.ink} strokeWidth="2" strokeLinecap="round"/></svg>;
    if (k === 'more') return <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="4" r="1.5" fill={fmb.ink}/><circle cx="10" cy="10" r="1.5" fill={fmb.ink}/><circle cx="10" cy="16" r="1.5" fill={fmb.ink}/></svg>;
    if (k === 'search') return <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="9" cy="9" r="6" stroke={fmb.ink} strokeWidth="2" fill="none"/><path d="M14 14l4 4" stroke={fmb.ink} strokeWidth="2" strokeLinecap="round"/></svg>;
    if (k === 'add') return <svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 3v14M3 10h14" stroke={fmb.ink} strokeWidth="2" strokeLinecap="round"/></svg>;
    return null;
  };
  return (
    <div style={{ background: surface || 'transparent' }}>
      <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 4px' }}>
        <button style={{ width: 48, height: 48, borderRadius: '50%', background: 'transparent', border: 'none', display: 'grid', placeItems: 'center' }}>
          <Ico k={leading}/>
        </button>
        {!large && <div style={{ flex: 1, fontSize: 22, fontWeight: 500, color: fmb.ink, letterSpacing: 0 }}>{title}</div>}
        {large && <div style={{ flex: 1 }}/>}
        {trailing && (
          <button style={{ width: 48, height: 48, borderRadius: '50%', background: 'transparent', border: 'none', display: 'grid', placeItems: 'center' }}>
            <Ico k={trailing}/>
          </button>
        )}
      </div>
      {large && (
        <div style={{ padding: '8px 22px 14px', fontSize: 28, fontWeight: 400, color: fmb.ink, letterSpacing: -0.2 }}>
          {title}
        </div>
      )}
    </div>
  );
}

// Filled button (M3) — fully rounded pill
function AFilledButton({ children, color = fmb.primary, fg = '#fff', icon, style = {} }) {
  return (
    <button style={{
      height: 48, borderRadius: 24, border: 'none',
      background: color, color: fg,
      fontSize: 14, fontWeight: 500, letterSpacing: 0.1,
      fontFamily: ROBOTO, padding: '0 22px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      ...style,
    }}>
      {icon}{children}
    </button>
  );
}

// Outlined button
function AOutlinedButton({ children, style = {} }) {
  return (
    <button style={{
      height: 44, borderRadius: 22,
      background: 'transparent', border: `1px solid ${fmb.mintEdge}`,
      color: fmb.ink, fontSize: 13, fontWeight: 500,
      fontFamily: ROBOTO, padding: '0 18px',
      ...style,
    }}>{children}</button>
  );
}

// FAB
function AFab({ icon, extended, label, color = fmb.primary }) {
  return (
    <div style={{
      height: 56, minWidth: 56, padding: extended ? '0 18px 0 16px' : 0,
      borderRadius: 16,
      background: color, color: 'white',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 6px 14px rgba(20,184,166,0.4)',
      fontSize: 14, fontWeight: 500, fontFamily: ROBOTO,
      justifyContent: 'center',
    }}>
      {icon}{extended && label}
    </div>
  );
}

// Bottom navigation bar
function ABottomNav({ active = 0 }) {
  const items = [
    { l: 'Home', d: 'M2 8l8-6 8 6v10H2z' },
    { l: 'Bookings', d: 'M3 4h14v14H3zM3 8h14M7 2v4M13 2v4' },
    { l: 'Loyalty', d: 'M10 4l2 4 4 .6-3 3 .7 4-3.7-2-3.7 2 .7-4-3-3 4-.6z' },
    { l: 'Profile', d: 'M10 11a4 4 0 100-8 4 4 0 000 8zM3 18a7 7 0 0114 0' },
  ];
  return (
    <div style={{
      height: 72, background: 'rgba(255,247,236,0.9)', backdropFilter: 'blur(12px)',
      borderTop: `1px solid ${fmb.mintEdge}`, display: 'flex',
      paddingBottom: 8, fontFamily: ROBOTO,
    }}>
      {items.map((it, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          <div style={{
            width: 56, height: 28, borderRadius: 16,
            background: i === active ? fmb.mint : 'transparent',
            display: 'grid', placeItems: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 20 20">
              <path d={it.d} stroke={i === active ? fmb.primaryDeep : fmb.inkSoft} strokeWidth="1.7" fill={i === active ? 'rgba(20,184,166,0.15)' : 'none'} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 11, fontWeight: i === active ? 600 : 400, color: i === active ? fmb.ink : fmb.inkSoft }}>{it.l}</div>
        </div>
      ))}
    </div>
  );
}

// App icon — adaptive (themed on Android 13+)
function AppIcon({ size = 128, radius }) {
  const r = radius ?? size * 0.225;
  return (
    <div style={{
      width: size, height: size, borderRadius: r, position: 'relative',
      overflow: 'hidden',
      background: `radial-gradient(120% 120% at 30% 0%, #2DD4BF 0%, #14B8A6 45%, #0F766E 100%)`,
      boxShadow: `0 ${size*0.06}px ${size*0.18}px rgba(15,118,110,0.35), inset 0 1px 0 rgba(255,255,255,0.35)`,
    }}>
      <div style={{
        position: 'absolute', width: size*0.9, height: size*0.9, borderRadius: '50%',
        bottom: -size*0.4, right: -size*0.3,
        background: 'radial-gradient(circle, rgba(245,199,126,0.55) 0%, rgba(245,199,126,0) 60%)',
      }}/>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: r,
        background: 'linear-gradient(160deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 35%)',
      }}/>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id={`adropg-${size}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF"/>
            <stop offset="1" stopColor="#E6F7F4"/>
          </linearGradient>
        </defs>
        <path d="M 50 22 C 50 22, 30 44, 30 60 C 30 71, 39 80, 50 80 C 61 80, 70 71, 70 60 C 70 44, 50 22, 50 22 Z" fill={`url(#adropg-${size})`}/>
        <text x="50" y="68" textAnchor="middle" fontFamily={ROBOTO} fontWeight="700" fontSize="26" fill="#0F766E" letterSpacing="-1">P</text>
        <circle cx="50" cy="36" r="2.4" fill="#0F766E" opacity="0.55"/>
      </svg>
    </div>
  );
}

function LogoMark({ size = 56 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size*0.3,
      background: `linear-gradient(160deg, #2DD4BF 0%, #0F766E 100%)`,
      display: 'grid', placeItems: 'center',
      boxShadow: '0 10px 24px rgba(15,118,110,0.3)',
    }}>
      <svg width={size*0.55} height={size*0.55} viewBox="0 0 100 100">
        <path d="M50 18 C50 18 28 42 28 60 C28 72 38 82 50 82 C62 82 72 72 72 60 C72 42 50 18 50 18 Z" fill="#FFFFFF"/>
        <text x="50" y="69" textAnchor="middle" fontFamily={ROBOTO} fontWeight="700" fontSize="28" fill="#0F766E" letterSpacing="-1">P</text>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. Phone OTP
// ─────────────────────────────────────────────────────────────
function ScreenOTP() {
  return (
    <APhone>
      <div style={{ padding: '12px 24px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: 30 }}>
          <div style={{ position: 'absolute', width: 180, height: 180, top: -32, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,199,126,0.45) 0%, rgba(245,199,126,0) 65%)' }}/>
          <LogoMark size={68}/>
        </div>
        <div style={{ marginTop: 22, textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 500, color: fmb.ink, letterSpacing: -0.3 }}>Find My Bay</div>
          <div style={{ marginTop: 8, fontSize: 13, color: fmb.inkSoft, lineHeight: 1.5, padding: '0 16px' }}>Book a free wash bay in seconds — across the UAE.</div>
        </div>

        {/* Material outlined text field */}
        <div style={{ marginTop: 32 }}>
          <div style={{
            position: 'relative', height: 56, borderRadius: 4,
            border: `1.5px solid ${fmb.primary}`,
            background: 'transparent', display: 'flex', alignItems: 'center',
            padding: '0 14px', gap: 10,
          }}>
            <span style={{
              position: 'absolute', top: -8, left: 12, padding: '0 6px',
              background: fmb.cream, fontSize: 11, color: fmb.primaryDeep, fontWeight: 500,
            }}>Mobile number</span>
            <span style={{ fontSize: 15, color: fmb.ink, fontWeight: 500 }}>🇦🇪 +971</span>
            <div style={{ width: 1, height: 20, background: fmb.mintEdge }}/>
            <span style={{ fontSize: 15, color: fmb.inkSoft }}>50 123 4567</span>
          </div>
          <div style={{ fontSize: 11, color: fmb.inkSoft, marginTop: 6, paddingLeft: 14 }}>We'll text you a 6-digit code.</div>
        </div>

        <div style={{ marginTop: 16 }}>
          <AFilledButton style={{ width: '100%' }}>Send code</AFilledButton>
        </div>

        <div style={{ flex: 1 }}/>
        <div style={{ textAlign: 'center', fontSize: 11, color: fmb.inkSoft, lineHeight: 1.5, paddingBottom: 32 }}>
          By continuing you agree to the<br/>
          <span style={{ color: fmb.primaryDeep, fontWeight: 500 }}>Terms</span> &amp; <span style={{ color: fmb.primaryDeep, fontWeight: 500 }}>Privacy Policy</span>
        </div>
      </div>
    </APhone>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. OTP Verify
// ─────────────────────────────────────────────────────────────
function ScreenVerify() {
  const digits = ['3','0','7','5','2',''];
  return (
    <APhone>
      <ATopBar title="Verify number" leading="back"/>
      <div style={{ padding: '8px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: fmb.ink, lineHeight: 1.25 }}>
          Enter the code we just sent
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: fmb.inkSoft }}>
          Sent to <span style={{ color: fmb.primaryDeep, fontWeight: 500 }}>+971 50 123 4567</span>
        </div>

        <div style={{ marginTop: 28, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          {digits.map((d, i) => {
            const focus = i === 5;
            return (
              <div key={i} style={{
                width: 40, height: 56, borderRadius: 4,
                background: 'transparent',
                border: `1.5px solid ${focus ? fmb.primary : (d ? fmb.primaryDeep : fmb.mintEdge)}`,
                boxShadow: focus ? `0 0 0 4px rgba(20,184,166,0.15)` : 'none',
                display: 'grid', placeItems: 'center',
                fontSize: 22, fontWeight: 500, color: fmb.ink,
              }}>{d}</div>
            );
          })}
        </div>

        <div style={{ marginTop: 16, fontSize: 13, color: fmb.inkSoft }}>
          Resend in <span style={{ color: fmb.primaryDeep, fontWeight: 500 }}>0:24</span>
        </div>

        <div style={{ flex: 1 }}/>
        <AFilledButton style={{ width: '100%', marginBottom: 32 }}>Verify &amp; continue</AFilledButton>
      </div>
    </APhone>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Nearby Map
// ─────────────────────────────────────────────────────────────
function ScreenMap() {
  return (
    <APhone>
      <ATopBar title="Find My Bay" leading="menu" trailing="search" large/>
      <div style={{ position: 'relative', flex: 1, margin: '0 16px 0', borderRadius: 24, overflow: 'hidden', background: '#DCEFEA' }}>
        <svg width="100%" height="100%" viewBox="0 0 280 360" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
          <path d="M 0 60 Q 80 40 180 70 L 280 100 L 280 360 L 0 360 Z" fill="#E9F4F0"/>
          <path d="M 0 200 Q 100 180 200 220 L 280 240 L 280 360 L 0 360 Z" fill="#FCE7C8" opacity="0.45"/>
          <path d="M 0 0 L 280 0 L 280 60 Q 180 80 100 70 Q 40 60 0 80 Z" fill="#BFE3DC"/>
          <path d="M -10 180 Q 80 170 280 200" stroke="white" strokeWidth="10" fill="none"/>
          <path d="M 140 -10 Q 130 100 160 180 Q 180 260 130 370" stroke="white" strokeWidth="10" fill="none"/>
          <path d="M -10 280 Q 100 260 280 290" stroke="white" strokeWidth="6" fill="none"/>
          <circle cx="60" cy="120" r="22" fill="#CDEEE8"/>
          <circle cx="220" cy="280" r="18" fill="#CDEEE8"/>
        </svg>

        {/* you-pulse */}
        <div style={{ position: 'absolute', left: 134, top: 168 }}>
          <div style={{ position: 'absolute', width: 36, height: 36, borderRadius: '50%', background: 'rgba(20,184,166,0.25)', left: -10, top: -10 }}/>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: fmb.primary, border: '3px solid white' }}/>
        </div>

        {/* pins */}
        {[
          { x: 60, y: 90, n: 2, active: true },
          { x: 200, y: 130, n: 4 },
          { x: 220, y: 250, n: 1 },
        ].map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: p.x, top: p.y }}>
            <div style={{
              padding: '4px 10px 4px 8px', borderRadius: 999,
              background: p.active ? fmb.primaryDeep : fmb.primary,
              color: 'white', fontSize: 11, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: p.active ? '0 6px 16px rgba(15,118,110,0.4)' : '0 4px 10px rgba(20,184,166,0.35)',
              transform: p.active ? 'scale(1.05)' : 'none',
            }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', color: p.active ? fmb.primaryDeep : fmb.primary, display: 'grid', placeItems: 'center', fontSize: 10 }}>{p.n}</span>
              free
            </div>
          </div>
        ))}

        {/* M3 chips row */}
        <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 6 }}>
          {[
            { l: 'Free now', sel: true },
            { l: 'Under AED 40' },
            { l: 'Open late' },
          ].map((c, i) => (
            <div key={i} style={{
              height: 30, padding: c.sel ? '0 12px 0 8px' : '0 12px',
              borderRadius: 8,
              background: c.sel ? fmb.mint : 'rgba(255,255,255,0.92)',
              border: `1px solid ${c.sel ? fmb.primary : fmb.mintEdge}`,
              fontSize: 11, fontWeight: 500, color: c.sel ? fmb.primaryDeep : fmb.ink,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {c.sel && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 6l2 2 4-4" stroke={fmb.primaryDeep} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              {c.l}
            </div>
          ))}
        </div>

        {/* FAB — my location */}
        <div style={{ position: 'absolute', bottom: 14, right: 14 }}>
          <AFab color={fmb.white} icon={<svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="3" fill={fmb.primary}/><circle cx="11" cy="11" r="7" stroke={fmb.primary} strokeWidth="1.5" fill="none"/><path d="M11 1v3M11 18v3M1 11h3M18 11h3" stroke={fmb.primary} strokeWidth="1.5" strokeLinecap="round"/></svg>}/>
        </div>
      </div>

      {/* card peek */}
      <div style={{ padding: '12px 16px 8px' }}>
        <div style={{
          background: fmb.white, borderRadius: 16, padding: 12,
          display: 'flex', gap: 12, alignItems: 'center',
          boxShadow: '0 4px 16px rgba(11,59,54,0.06)',
          border: `1px solid ${fmb.mintEdge}`,
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${fmb.mint}, ${fmb.sand})`, display: 'grid', placeItems: 'center', fontSize: 20 }}>🚿</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: fmb.ink }}>Polaris Auto Spa</div>
            <div style={{ fontSize: 11, color: fmb.inkSoft, marginTop: 1 }}>Business Bay · 1.4 km · 6 min</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
              <span style={{ background: fmb.mint, color: fmb.primaryDeep, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6 }}>2 free now</span>
              <span style={{ color: fmb.ink, fontSize: 10, fontWeight: 500, padding: '3px 0' }}>from AED 35</span>
            </div>
          </div>
        </div>
      </div>
      <ABottomNav active={0}/>
    </APhone>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Vendor Detail
// ─────────────────────────────────────────────────────────────
function ScreenVendor() {
  return (
    <APhone>
      {/* hero */}
      <div style={{ position: 'relative', height: 150, background: `linear-gradient(135deg, ${fmb.mint} 0%, ${fmb.sand} 100%)`, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', right: -15, top: -25 }}/>
        <div style={{ position: 'absolute', width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', right: 70, top: 80 }}/>
        <button style={{ position: 'absolute', top: 8, left: 4, width: 48, height: 48, borderRadius: '50%', background: 'transparent', border: 'none', display: 'grid', placeItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 20 20"><path d="M13 4l-6 6 6 6" stroke={fmb.ink} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button style={{ position: 'absolute', top: 8, right: 4, width: 48, height: 48, borderRadius: '50%', background: 'transparent', border: 'none', display: 'grid', placeItems: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 15 L3 9 a3 3 0 0 1 5-3 a3 3 0 0 1 5 3 z" fill="none" stroke={fmb.coral} strokeWidth="1.6" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ position: 'absolute', left: 18, bottom: 14, fontSize: 36 }}>🚗</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '14px 22px 0' }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: fmb.ink }}>Polaris Auto Spa</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12, color: fmb.inkSoft }}>
            <span>Business Bay · Dubai · 1.4 km</span>
            <span>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ color: fmb.sandDeep }}>★</span>
              <span style={{ color: fmb.ink, fontWeight: 500 }}>4.7</span>
              <span>(214)</span>
            </span>
          </div>
        </div>

        {/* bay status — M3 surface tonal */}
        <div style={{ margin: '14px 16px 0', background: fmb.mint, borderRadius: 16, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: fmb.primaryDeep, letterSpacing: 0.4, textTransform: 'uppercase' }}>Live bay status</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: fmb.inkSoft }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: fmb.primary }}/>
              Updated now
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {[
              { l: 'Bay 1', s: 'free' },
              { l: 'Bay 2', s: 'free' },
              { l: 'Bay 3', s: 'busy' },
              { l: 'Bay 4', s: 'busy' },
            ].map((b, i) => (
              <div key={i} style={{
                flex: 1, padding: '8px 6px', borderRadius: 10,
                background: b.s === 'free' ? fmb.white : fmb.coralSoft,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 9, color: fmb.inkSoft, fontWeight: 500 }}>{b.l}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: b.s === 'free' ? fmb.primaryDeep : fmb.coral, marginTop: 1 }}>{b.s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* services */}
        <div style={{ padding: '14px 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: fmb.ink }}>Services</span>
          <span style={{ fontSize: 12, color: fmb.primaryDeep, fontWeight: 500 }}>See all</span>
        </div>
        {[
          { n: 'Quick Exterior Wash', d: '20 min · VAT incl.', p: 35, picked: true, e: '💦' },
          { n: 'Premium Wash & Wax', d: '45 min · VAT incl.', p: 89, e: '✨' },
        ].map((s, i) => (
          <div key={i} style={{
            margin: '8px 16px 0', padding: '12px 14px', borderRadius: 14,
            background: s.picked ? fmb.mint : fmb.white,
            border: `1px solid ${s.picked ? fmb.primary : fmb.mintEdge}`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.7)', display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>{s.e}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: fmb.ink }}>{s.n}</div>
              <div style={{ fontSize: 11, color: fmb.inkSoft, marginTop: 2 }}>{s.d}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: fmb.primaryDeep }}>AED {s.p}</div>
          </div>
        ))}
        <div style={{ height: 16 }}/>
      </div>

      <div style={{ padding: '10px 16px 14px', background: fmb.cream, borderTop: `1px solid ${fmb.mintEdge}` }}>
        <AFilledButton style={{ width: '100%' }} icon={<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 2h12v12H2z" fill="none" stroke="white" strokeWidth="1.5"/><path d="M5 8h6M5 5h6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}>
          Book a wash · AED 35
        </AFilledButton>
      </div>
    </APhone>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. Slot Picker
// ─────────────────────────────────────────────────────────────
function ScreenSlot() {
  const slots = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00'];
  const past = new Set(['08:00','08:30']);
  const selected = '10:00';
  return (
    <APhone>
      <ATopBar title="Pick a time" leading="back"/>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: fmb.primaryDeep, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 6 }}>Date</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { d: 'Mon', n: '28', l: 'Today', sel: false },
            { d: 'Tue', n: '29', l: 'Tomorrow', sel: true },
            { d: 'Wed', n: '30', l: '', sel: false },
            { d: 'Thu', n: '01', l: '', sel: false },
          ].map((d, i) => (
            <div key={i} style={{
              flex: 1, padding: '10px 0 12px', borderRadius: 14, textAlign: 'center',
              background: d.sel ? fmb.primaryDeep : fmb.white,
              border: `1px solid ${d.sel ? fmb.primaryDeep : fmb.mintEdge}`,
              color: d.sel ? 'white' : fmb.ink,
            }}>
              <div style={{ fontSize: 10, opacity: 0.85 }}>{d.d}</div>
              <div style={{ fontSize: 18, fontWeight: 500, marginTop: 2 }}>{d.n}</div>
              <div style={{ fontSize: 9, opacity: d.sel ? 0.85 : 0.6, marginTop: 2, height: 10 }}>{d.l}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 6px 8px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: fmb.primaryDeep, letterSpacing: 0.4, textTransform: 'uppercase' }}>Morning slots</div>
          <div style={{ fontSize: 10, color: fmb.inkSoft, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: fmb.primary }}/>
            Bay 1 available
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {slots.map((t, i) => {
            const isPast = past.has(t);
            const isSel = t === selected;
            return (
              <div key={i} style={{
                padding: '12px 0', borderRadius: 12, textAlign: 'center',
                fontSize: 14, fontWeight: 500,
                background: isSel ? fmb.primary : (isPast ? '#F1F1EE' : fmb.white),
                color: isSel ? 'white' : (isPast ? '#B7B7B0' : fmb.ink),
                border: `1px solid ${isSel ? fmb.primary : (isPast ? 'transparent' : fmb.mintEdge)}`,
                textDecoration: isPast ? 'line-through' : 'none',
                boxShadow: isSel ? '0 6px 14px rgba(20,184,166,0.3)' : 'none',
              }}>{t}</div>
            );
          })}
        </div>

        <div style={{ marginTop: 16, padding: 14, borderRadius: 16, background: fmb.sand, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🚦</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: fmb.primaryDeep, fontWeight: 600 }}>You'll get a smart-leave alert</div>
            <div style={{ fontSize: 11, color: fmb.ink, opacity: 0.7, marginTop: 2 }}>We'll ping you when it's time, factoring traffic.</div>
          </div>
        </div>
        <div style={{ height: 16 }}/>
      </div>
      <div style={{ padding: '10px 16px 14px', background: fmb.cream, borderTop: `1px solid ${fmb.mintEdge}` }}>
        <AFilledButton style={{ width: '100%' }}>Confirm · Tue 10:00 · AED 35</AFilledButton>
      </div>
    </APhone>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. Booking Confirmed
// ─────────────────────────────────────────────────────────────
function ScreenConfirmed() {
  return (
    <APhone>
      <ATopBar title="" leading="back" trailing="more"/>
      <div style={{ flex: 1, padding: '0 22px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'relative', marginTop: 4 }}>
          <div style={{ position: 'absolute', inset: -22, borderRadius: '50%', background: 'rgba(245,199,126,0.35)' }}/>
          <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', background: fmb.mint }}/>
          <div style={{
            position: 'relative', width: 64, height: 64, borderRadius: '50%',
            background: `linear-gradient(160deg, #2DD4BF, ${fmb.primaryDeep})`,
            display: 'grid', placeItems: 'center',
            boxShadow: '0 12px 28px rgba(15,118,110,0.35)',
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28"><path d="M7 14l5 5 9-10" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>

        <div style={{ marginTop: 24, fontSize: 22, fontWeight: 500, color: fmb.ink }}>You're all set!</div>
        <div style={{ marginTop: 6, fontSize: 13, color: fmb.inkSoft, textAlign: 'center', lineHeight: 1.5, padding: '0 12px' }}>
          We'll send a smart-leave alert so you arrive on time — even in traffic.
        </div>

        <div style={{
          marginTop: 22, width: '100%', background: fmb.white,
          borderRadius: 16, padding: '14px 16px',
          border: `1px solid ${fmb.mintEdge}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${fmb.mint}, ${fmb.sand})`, display: 'grid', placeItems: 'center', fontSize: 18 }}>🚿</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: fmb.ink }}>Polaris Auto Spa</div>
              <div style={{ fontSize: 10, color: fmb.inkSoft }}>Business Bay, Dubai</div>
            </div>
          </div>
          <div style={{ height: 1, background: fmb.hairline, margin: '12px 0' }}/>
          {[
            ['Service', 'Quick Exterior Wash'],
            ['Bay', 'Bay 1'],
            ['Time', 'Tue 28 Apr · 10:00'],
            ['Duration', '20 min'],
          ].map(([k, v], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
              <span style={{ fontSize: 11, color: fmb.inkSoft }}>{k}</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: fmb.ink }}>{v}</span>
            </div>
          ))}
          <div style={{ height: 1, background: fmb.hairline, margin: '8px 0' }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: fmb.ink }}>Total</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: fmb.primaryDeep }}>AED 35</span>
          </div>
        </div>

        <div style={{ marginTop: 12, width: '100%', display: 'flex', gap: 8 }}>
          <AOutlinedButton style={{ flex: 1 }}>📅 Calendar</AOutlinedButton>
          <AOutlinedButton style={{ flex: 1 }}>🧭 Directions</AOutlinedButton>
        </div>

        <div style={{ flex: 1 }}/>
        <AFilledButton style={{ width: '100%', marginBottom: 28 }}>Done</AFilledButton>
      </div>
    </APhone>
  );
}

// ─────────────────────────────────────────────────────────────
// 7. Leave Now
// ─────────────────────────────────────────────────────────────
function ScreenLeave() {
  return (
    <APhone bg={`linear-gradient(165deg, #2DD4BF 0%, #0F766E 75%, #0B3B36 100%)`} dark>
      <div style={{ position: 'absolute', top: 50, left: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,199,126,0.45) 0%, rgba(245,199,126,0) 65%)' }}/>
      <div style={{ position: 'absolute', bottom: 100, right: -50, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,212,191,0.5) 0%, rgba(45,212,191,0) 60%)' }}/>

      <div style={{ flex: 1, padding: '8px 22px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2 }}>
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: 1.5, textTransform: 'uppercase' }}>Smart leave alert</span>
          <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', fontSize: 16 }}>×</button>
        </div>

        <div style={{ position: 'relative', marginTop: 26 }}>
          <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', background: 'rgba(245,199,126,0.25)', animation: 'pulse 2s ease-in-out infinite' }}/>
          <div style={{
            position: 'relative', width: 80, height: 80, borderRadius: 26,
            background: `linear-gradient(160deg, ${fmb.sand}, ${fmb.sandDeep})`,
            display: 'grid', placeItems: 'center', fontSize: 42,
            boxShadow: '0 14px 32px rgba(0,0,0,0.25)',
          }}>🚗</div>
        </div>

        <div style={{ marginTop: 22, fontSize: 36, fontWeight: 700, color: 'white', letterSpacing: -0.8 }}>Leave now</div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 1.5 }}>
          Heading to <span style={{ fontWeight: 600, color: fmb.sand }}>Polaris Auto Spa</span><br/>
          for your <span style={{ fontWeight: 500 }}>10:00</span> wash
        </div>

        <div style={{
          marginTop: 26, width: '100%', borderRadius: 22,
          background: 'rgba(255,255,255,0.95)',
          padding: 16, display: 'flex', alignItems: 'stretch',
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: fmb.inkSoft, fontWeight: 500 }}>Drive</div>
            <div style={{ marginTop: 4, fontSize: 30, fontWeight: 700, color: fmb.ink, letterSpacing: -0.6 }}>
              12<span style={{ fontSize: 13, fontWeight: 500, color: fmb.inkSoft, marginLeft: 2 }}>min</span>
            </div>
            <div style={{ fontSize: 10, color: fmb.coral, fontWeight: 600, marginTop: 2 }}>+3 traffic</div>
          </div>
          <div style={{ width: 1, background: fmb.hairline, margin: '4px 0' }}/>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: fmb.inkSoft, fontWeight: 500 }}>Slot</div>
            <div style={{ marginTop: 4, fontSize: 30, fontWeight: 700, color: fmb.primaryDeep, letterSpacing: -0.6 }}>10:00</div>
            <div style={{ fontSize: 10, color: fmb.inkSoft, marginTop: 2 }}>Bay 1 · Tue</div>
          </div>
        </div>

        <div style={{ flex: 1 }}/>

        <button style={{
          width: '100%', height: 56, borderRadius: 28, border: 'none',
          background: `linear-gradient(180deg, ${fmb.sand}, ${fmb.sandDeep})`,
          color: fmb.primaryDeep, fontSize: 15, fontWeight: 600,
          fontFamily: ROBOTO,
          boxShadow: '0 12px 26px rgba(245,199,126,0.45)',
        }}>I'M LEAVING NOW</button>
        <button style={{
          width: '100%', height: 44, borderRadius: 22,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.35)',
          color: 'white', fontSize: 13, fontWeight: 500, fontFamily: ROBOTO,
          marginTop: 8, marginBottom: 28,
        }}>Snooze 5 min</button>
      </div>
    </APhone>
  );
}

// ─────────────────────────────────────────────────────────────
// 8. My Bookings
// ─────────────────────────────────────────────────────────────
function ScreenBookings() {
  return (
    <APhone>
      <ATopBar title="My bookings" leading="menu" trailing="more" large/>

      {/* M3 segmented buttons */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ display: 'flex', borderRadius: 22, overflow: 'hidden', border: `1px solid ${fmb.mintEdge}` }}>
          {['Upcoming','Past'].map((t, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center', padding: '10px 0',
              fontSize: 12, fontWeight: 500,
              background: i === 0 ? fmb.mint : 'transparent',
              color: i === 0 ? fmb.primaryDeep : fmb.inkSoft,
              borderLeft: i === 1 ? `1px solid ${fmb.mintEdge}` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {i === 0 && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 6l2 2 4-4" stroke={fmb.primaryDeep} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              {t}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 16px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* active card */}
        <div style={{
          background: fmb.white, borderRadius: 16, overflow: 'hidden',
          border: `1.5px solid ${fmb.primary}`,
          boxShadow: '0 4px 12px rgba(20,184,166,0.12)',
        }}>
          <div style={{
            background: `linear-gradient(90deg, ${fmb.mint} 0%, ${fmb.sand} 100%)`,
            padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: fmb.primaryDeep, letterSpacing: 0.4, textTransform: 'uppercase' }}>Tomorrow · 10:00</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: fmb.primaryDeep }}>in 18h 14m</span>
          </div>
          <div style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${fmb.mint}, ${fmb.sand})`, display: 'grid', placeItems: 'center', fontSize: 18 }}>🚿</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: fmb.ink }}>Polaris Auto Spa</div>
                <div style={{ fontSize: 10, color: fmb.inkSoft }}>Quick Wash · Bay 1</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: fmb.primaryDeep }}>AED 35</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button style={{
                flex: 1, height: 36, borderRadius: 18, border: 'none',
                background: fmb.primaryDeep, color: 'white',
                fontSize: 11, fontWeight: 500, fontFamily: ROBOTO,
              }}>Show QR</button>
              <button style={{
                flex: 1, height: 36, borderRadius: 18,
                background: 'transparent', border: `1px solid ${fmb.mintEdge}`,
                color: fmb.ink, fontSize: 11, fontWeight: 500, fontFamily: ROBOTO,
              }}>Reschedule</button>
              <button style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'transparent', border: `1px solid ${fmb.mintEdge}`,
                color: fmb.coral, fontSize: 14, fontWeight: 600,
              }}>×</button>
            </div>
          </div>
        </div>

        {/* future card */}
        <div style={{ background: fmb.white, borderRadius: 16, padding: '12px 14px', border: `1px solid ${fmb.mintEdge}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 10, color: fmb.inkSoft, fontWeight: 500 }}>Sat 2 May · 14:30</div>
            <div style={{ fontSize: 9, color: fmb.primaryDeep, fontWeight: 600, background: fmb.mint, padding: '2px 8px', borderRadius: 6 }}>SCHEDULED</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${fmb.mint}, ${fmb.sand})`, display: 'grid', placeItems: 'center', fontSize: 18 }}>✨</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: fmb.ink }}>Marina Shine</div>
              <div style={{ fontSize: 10, color: fmb.inkSoft }}>Premium Wash · Bay 2</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: fmb.primaryDeep }}>AED 89</div>
          </div>
        </div>

        {/* loyalty teaser */}
        <div style={{
          background: `linear-gradient(135deg, ${fmb.sand} 0%, #FFE3D9 100%)`,
          borderRadius: 16, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 28 }}>🎁</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: fmb.ink }}>One free wash on us</div>
            <div style={{ fontSize: 10, color: fmb.inkSoft, marginTop: 2 }}>3 of 5 washes complete</div>
            <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)', overflow: 'hidden' }}>
              <div style={{ width: '60%', height: '100%', background: fmb.primary }}/>
            </div>
          </div>
        </div>
        <div style={{ height: 14 }}/>
      </div>

      {/* Extended FAB sits above bottom nav */}
      <div style={{ position: 'absolute', right: 16, bottom: 92, zIndex: 5 }}>
        <AFab extended label="New booking" icon={<svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 2v14M2 9h14" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}/>
      </div>

      <ABottomNav active={1}/>
    </APhone>
  );
}

Object.assign(window, {
  APhone, AppIcon, LogoMark, fmb,
  ScreenOTP, ScreenVerify, ScreenMap, ScreenVendor,
  ScreenSlot, ScreenConfirmed, ScreenLeave, ScreenBookings,
});
