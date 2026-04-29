// Find My Bay — refined screens
// Modern, fresh, clean, welcoming, warm
// Palette is exposed as CSS variables on :root in Find My Bay.html

const fmb = {
  primary: '#14B8A6',      // warm aqua
  primaryDeep: '#0F766E',  // deeper teal for ink-on-surface
  ink: '#0B3B36',          // body ink
  inkSoft: '#3F6B65',      // muted body
  cream: '#FFF7EC',        // warm welcoming bg
  sand: '#FCE7C8',         // warm accent
  sandDeep: '#F5C77E',     // CTA accent
  mint: '#E6F7F4',         // surface tint
  mintEdge: '#CDEEE8',     // borders
  coral: '#FF8B6B',        // alerts/busy
  coralSoft: '#FFE3D9',    // alert tint
  white: '#FFFFFF',
  hairline: 'rgba(11,59,54,0.08)',
};

// ─────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────
function StatusBar({ dark = false, time = '9:41' }) {
  const c = dark ? '#fff' : fmb.ink;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 28px 6px', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, "SF Pro", system-ui',
      position: 'relative', zIndex: 5,
    }}>
      <span style={{ fontWeight: 600, fontSize: 15, color: c, letterSpacing: -0.2 }}>{time}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="5" width="3" height="6" rx="0.6" fill={c}/><rect x="9" y="2.5" width="3" height="8.5" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="15" height="11" viewBox="0 0 17 12"><path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z" fill={c}/><path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z" fill={c}/><circle cx="8.5" cy="10.5" r="1.5" fill={c}/></svg>
        <svg width="24" height="11" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke={c} strokeOpacity="0.4" fill="none"/><rect x="2" y="2" width="20" height="9" rx="2" fill={c}/><path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill={c} fillOpacity="0.5"/></svg>
      </div>
    </div>
  );
}

function HomeIndicator({ dark = false }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 28,
      display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
      paddingBottom: 8, pointerEvents: 'none',
    }}>
      <div style={{
        width: 120, height: 4, borderRadius: 4,
        background: dark ? 'rgba(255,255,255,0.85)' : 'rgba(11,59,54,0.32)',
      }}/>
    </div>
  );
}

function Phone({ children, dark = false, bg }) {
  return (
    <div style={{
      width: 320, height: 660, borderRadius: 44, overflow: 'hidden',
      position: 'relative', background: bg || (dark ? '#0B3B36' : fmb.cream),
      boxShadow: '0 30px 60px rgba(11,59,54,0.18), 0 0 0 1px rgba(11,59,54,0.06)',
      fontFamily: '-apple-system, "SF Pro", system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{
        position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
        width: 100, height: 28, borderRadius: 18, background: '#000', zIndex: 50,
      }}/>
      <StatusBar dark={dark}/>
      <div style={{ height: 'calc(100% - 44px)', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      <HomeIndicator dark={dark}/>
    </div>
  );
}

// App icon — water drop + parking bay glyph
function AppIcon({ size = 128, radius }) {
  const r = radius ?? size * 0.225;
  return (
    <div style={{
      width: size, height: size, borderRadius: r, position: 'relative',
      overflow: 'hidden',
      background: `radial-gradient(120% 120% at 30% 0%, #2DD4BF 0%, #14B8A6 45%, #0F766E 100%)`,
      boxShadow: `0 ${size*0.06}px ${size*0.18}px rgba(15,118,110,0.35), inset 0 1px 0 rgba(255,255,255,0.35)`,
    }}>
      {/* warm sand glow */}
      <div style={{
        position: 'absolute', width: size*0.9, height: size*0.9, borderRadius: '50%',
        bottom: -size*0.4, right: -size*0.3,
        background: 'radial-gradient(circle, rgba(245,199,126,0.55) 0%, rgba(245,199,126,0) 60%)',
      }}/>
      {/* shine */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: r,
        background: 'linear-gradient(160deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 35%)',
      }}/>
      {/* glyph: stylised water drop with parking "P" cut */}
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="dropg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF"/>
            <stop offset="1" stopColor="#E6F7F4"/>
          </linearGradient>
        </defs>
        {/* drop */}
        <path d="M 50 22
                 C 50 22, 30 44, 30 60
                 C 30 71, 39 80, 50 80
                 C 61 80, 70 71, 70 60
                 C 70 44, 50 22, 50 22 Z"
              fill="url(#dropg)"/>
        {/* parking pin in drop */}
        <text x="50" y="68" textAnchor="middle"
              fontFamily="-apple-system, SF Pro Display, system-ui"
              fontWeight="800" fontSize="26" fill="#0F766E"
              letterSpacing="-1">P</text>
        {/* tiny location ping */}
        <circle cx="50" cy="36" r="2.4" fill="#0F766E" opacity="0.55"/>
      </svg>
    </div>
  );
}

// Logo wordmark icon (small, for splash)
function LogoMark({ size = 56 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size*0.3,
      background: `linear-gradient(160deg, #2DD4BF 0%, #0F766E 100%)`,
      display: 'grid', placeItems: 'center',
      boxShadow: '0 10px 24px rgba(15,118,110,0.3)',
    }}>
      <svg width={size*0.55} height={size*0.55} viewBox="0 0 100 100">
        <path d="M50 18 C50 18 28 42 28 60 C28 72 38 82 50 82 C62 82 72 72 72 60 C72 42 50 18 50 18 Z"
              fill="#FFFFFF"/>
        <text x="50" y="69" textAnchor="middle" fontFamily="-apple-system, system-ui"
              fontWeight="800" fontSize="28" fill="#0F766E" letterSpacing="-1">P</text>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. Phone OTP
// ─────────────────────────────────────────────────────────────
function ScreenOTP() {
  return (
    <Phone>
      <div style={{ padding: '24px 28px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* warm sand halo behind logo */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <div style={{
            position: 'absolute', width: 180, height: 180, top: -30,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,199,126,0.45) 0%, rgba(245,199,126,0) 65%)',
          }}/>
          <LogoMark size={68}/>
        </div>
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: fmb.ink, letterSpacing: -0.6 }}>Find My Bay</div>
          <div style={{ marginTop: 8, fontSize: 13, color: fmb.inkSoft, lineHeight: 1.5, padding: '0 16px' }}>
            Book a free wash bay in seconds — across the UAE.
          </div>
        </div>
        <div style={{ marginTop: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: fmb.primaryDeep, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>Mobile number</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: fmb.white, border: `1px solid ${fmb.mintEdge}`,
            borderRadius: 14, padding: '14px 16px',
            boxShadow: '0 1px 2px rgba(11,59,54,0.04)',
          }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: fmb.ink }}>🇦🇪 +971</span>
            <div style={{ width: 1, height: 18, background: fmb.mintEdge }}/>
            <span style={{ fontSize: 15, color: fmb.inkSoft, letterSpacing: 0.5 }}>50 123 4567</span>
          </div>
        </div>
        <button style={{
          marginTop: 16, height: 52, borderRadius: 14, border: 'none',
          background: fmb.primary, color: 'white',
          fontSize: 15, fontWeight: 600, letterSpacing: -0.2,
          boxShadow: '0 6px 16px rgba(20,184,166,0.35)',
        }}>Send code</button>
        <div style={{ flex: 1 }}/>
        <div style={{ textAlign: 'center', fontSize: 11, color: fmb.inkSoft, lineHeight: 1.5, paddingBottom: 28 }}>
          By continuing you agree to the<br/>
          <span style={{ color: fmb.primaryDeep, fontWeight: 500 }}>Terms</span> &amp; <span style={{ color: fmb.primaryDeep, fontWeight: 500 }}>Privacy Policy</span>
        </div>
      </div>
    </Phone>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. OTP Verify
// ─────────────────────────────────────────────────────────────
function ScreenVerify() {
  const digits = ['3','0','7','5','2',''];
  return (
    <Phone>
      <div style={{ padding: '8px 28px 0', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: fmb.white, border: `1px solid ${fmb.mintEdge}`,
          display: 'grid', placeItems: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M9 1L3 7l6 6" stroke={fmb.ink} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>
      <div style={{ padding: '20px 28px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: fmb.ink, letterSpacing: -0.5, lineHeight: 1.2 }}>
          Enter the code<br/>we just sent you
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: fmb.inkSoft, lineHeight: 1.5 }}>
          A 6-digit code was sent to<br/>
          <span style={{ color: fmb.primaryDeep, fontWeight: 600 }}>+971 50 123 4567</span>
        </div>
        <div style={{ marginTop: 32, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          {digits.map((d, i) => (
            <div key={i} style={{
              width: 40, height: 52, borderRadius: 12,
              background: d ? fmb.mint : fmb.white,
              border: `1.5px solid ${d ? fmb.primary : fmb.mintEdge}`,
              display: 'grid', placeItems: 'center',
              fontSize: 22, fontWeight: 700, color: fmb.ink,
              boxShadow: i === 5 ? `0 0 0 4px rgba(20,184,166,0.15)` : 'none',
              borderColor: i === 5 ? fmb.primary : (d ? fmb.primary : fmb.mintEdge),
            }}>{d}</div>
          ))}
        </div>
        <div style={{ marginTop: 18, fontSize: 12, color: fmb.inkSoft, textAlign: 'center' }}>
          Didn't get it? <span style={{ color: fmb.primaryDeep, fontWeight: 600 }}>Resend in 0:24</span>
        </div>
        <div style={{ flex: 1 }}/>
        <button style={{
          height: 52, borderRadius: 14, border: 'none',
          background: fmb.primary, color: 'white',
          fontSize: 15, fontWeight: 600, letterSpacing: -0.2,
          boxShadow: '0 6px 16px rgba(20,184,166,0.35)',
          marginBottom: 28,
        }}>Verify &amp; continue</button>
      </div>
    </Phone>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Nearby Map
// ─────────────────────────────────────────────────────────────
function ScreenMap() {
  return (
    <Phone>
      {/* hero greeting */}
      <div style={{ padding: '8px 24px 12px' }}>
        <div style={{ fontSize: 12, color: fmb.inkSoft }}>Good morning, Sara ☀️</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: fmb.ink, letterSpacing: -0.4 }}>Nearby car washes</div>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: fmb.mint, display: 'grid', placeItems: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M11.5 7a4.5 4.5 0 11-1.32-3.18M11.5 1.5V4H9" stroke={fmb.primaryDeep} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
      </div>

      {/* map */}
      <div style={{ position: 'relative', flex: 1, margin: '0 16px', borderRadius: 24, overflow: 'hidden', background: '#DCEFEA' }}>
        {/* roads / land */}
        <svg width="100%" height="100%" viewBox="0 0 280 360" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
          {/* land patches */}
          <path d="M 0 60 Q 80 40 180 70 L 280 100 L 280 360 L 0 360 Z" fill="#E9F4F0"/>
          <path d="M 0 200 Q 100 180 200 220 L 280 240 L 280 360 L 0 360 Z" fill="#FCE7C8" opacity="0.45"/>
          {/* water (top corner) */}
          <path d="M 0 0 L 280 0 L 280 60 Q 180 80 100 70 Q 40 60 0 80 Z" fill="#BFE3DC"/>
          {/* roads */}
          <path d="M -10 180 Q 80 170 280 200" stroke="white" strokeWidth="10" fill="none"/>
          <path d="M 140 -10 Q 130 100 160 180 Q 180 260 130 370" stroke="white" strokeWidth="10" fill="none"/>
          <path d="M -10 280 Q 100 260 280 290" stroke="white" strokeWidth="6" fill="none"/>
          {/* park */}
          <circle cx="60" cy="120" r="22" fill="#CDEEE8"/>
          <circle cx="220" cy="280" r="18" fill="#CDEEE8"/>
        </svg>

        {/* "you" pulse */}
        <div style={{ position: 'absolute', left: 134, top: 168 }}>
          <div style={{ position: 'absolute', width: 36, height: 36, borderRadius: '50%', background: 'rgba(20,184,166,0.25)', left: -10, top: -10 }}/>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: fmb.primary, border: '3px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}/>
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
              color: 'white', fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: p.active ? '0 6px 16px rgba(15,118,110,0.4)' : '0 4px 10px rgba(20,184,166,0.35)',
              transform: p.active ? 'scale(1.05)' : 'none',
            }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', color: p.active ? fmb.primaryDeep : fmb.primary, display: 'grid', placeItems: 'center', fontSize: 10 }}>{p.n}</span>
              free
            </div>
            <div style={{ width: 8, height: 8, background: p.active ? fmb.primaryDeep : fmb.primary, transform: 'rotate(45deg)', margin: '-3px auto 0' }}/>
          </div>
        ))}

        {/* search pill */}
        <div style={{
          position: 'absolute', top: 14, left: 14, right: 14,
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)',
          borderRadius: 14, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 14px rgba(11,59,54,0.08)',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4.5" stroke={fmb.inkSoft} strokeWidth="1.6" fill="none"/><path d="M9.5 9.5l3 3" stroke={fmb.inkSoft} strokeWidth="1.6" strokeLinecap="round"/></svg>
          <span style={{ fontSize: 13, color: fmb.inkSoft }}>Search by area or vendor</span>
        </div>

        {/* filter chips */}
        <div style={{ position: 'absolute', top: 60, left: 14, display: 'flex', gap: 6 }}>
          {['Free now','Under AED 40','Open late'].map((c, i) => (
            <div key={i} style={{
              background: i===0 ? fmb.ink : 'rgba(255,255,255,0.92)',
              color: i===0 ? 'white' : fmb.ink,
              fontSize: 11, fontWeight: 600,
              padding: '6px 10px', borderRadius: 10,
              boxShadow: '0 2px 6px rgba(11,59,54,0.06)',
            }}>{c}</div>
          ))}
        </div>
      </div>

      {/* card peek */}
      <div style={{ padding: '12px 16px 28px' }}>
        <div style={{
          background: fmb.white, borderRadius: 18, padding: 14,
          boxShadow: '0 8px 24px rgba(11,59,54,0.08)',
          display: 'flex', gap: 12, alignItems: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `linear-gradient(135deg, ${fmb.mint}, ${fmb.sand})`,
            display: 'grid', placeItems: 'center', fontSize: 22,
          }}>🚿</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: fmb.ink }}>Polaris Auto Spa</span>
              <span style={{ fontSize: 10, color: fmb.sandDeep }}>★</span>
              <span style={{ fontSize: 11, color: fmb.inkSoft, fontWeight: 600 }}>4.7</span>
            </div>
            <div style={{ fontSize: 11, color: fmb.inkSoft, marginTop: 2 }}>Business Bay · 1.4 km · 6 min</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <span style={{ background: fmb.mint, color: fmb.primaryDeep, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>2 free now</span>
              <span style={{ color: fmb.ink, fontSize: 10, fontWeight: 600, padding: '3px 0' }}>from AED 35</span>
            </div>
          </div>
        </div>
      </div>
    </Phone>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Vendor Detail
// ─────────────────────────────────────────────────────────────
function ScreenVendor() {
  return (
    <Phone>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* hero */}
        <div style={{
          margin: '4px 16px 0', height: 130, borderRadius: 22,
          background: `linear-gradient(135deg, ${fmb.mint} 0%, ${fmb.sand} 100%)`,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* deco bubbles */}
          <div style={{ position: 'absolute', width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', right: -10, top: -20 }}/>
          <div style={{ position: 'absolute', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', right: 60, top: 70 }}/>
          {/* back */}
          <div style={{
            position: 'absolute', top: 12, left: 12,
            width: 34, height: 34, borderRadius: 12,
            background: 'rgba(255,255,255,0.9)', display: 'grid', placeItems: 'center',
            boxShadow: '0 2px 6px rgba(11,59,54,0.08)',
          }}>
            <svg width="12" height="12" viewBox="0 0 14 14"><path d="M9 1L3 7l6 6" stroke={fmb.ink} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          {/* heart */}
          <div style={{
            position: 'absolute', top: 12, right: 12,
            width: 34, height: 34, borderRadius: 12,
            background: 'rgba(255,255,255,0.9)', display: 'grid', placeItems: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 12 L2 7 a3 3 0 0 1 5-3 a3 3 0 0 1 5 3 z" fill="none" stroke={fmb.coral} strokeWidth="1.6" strokeLinejoin="round"/></svg>
          </div>
          {/* glyph */}
          <div style={{ position: 'absolute', left: 18, bottom: 14, fontSize: 36 }}>🚗</div>
        </div>

        {/* title block */}
        <div style={{ padding: '14px 22px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: fmb.ink, letterSpacing: -0.4 }}>Polaris Auto Spa</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, color: fmb.sandDeep }}>★</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: fmb.ink }}>4.7</span>
              <span style={{ fontSize: 10, color: fmb.inkSoft }}>(214)</span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: fmb.inkSoft, marginTop: 2 }}>Business Bay · Dubai · 1.4 km</div>
        </div>

        {/* bay status */}
        <div style={{ margin: '12px 16px 0', background: fmb.white, borderRadius: 18, padding: '12px 14px', border: `1px solid ${fmb.mintEdge}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: fmb.primaryDeep, letterSpacing: 0.3, textTransform: 'uppercase' }}>Live bay status</span>
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
                background: b.s === 'free' ? fmb.mint : fmb.coralSoft,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 9, color: fmb.inkSoft, fontWeight: 600 }}>{b.l}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: b.s === 'free' ? fmb.primaryDeep : fmb.coral, marginTop: 1 }}>{b.s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* services */}
        <div style={{ padding: '14px 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: fmb.ink }}>Services</span>
          <span style={{ fontSize: 11, color: fmb.primaryDeep, fontWeight: 600 }}>See all</span>
        </div>
        {[
          { n: 'Quick Exterior Wash', d: '20 min · VAT incl.', p: 35, picked: true },
          { n: 'Premium Wash & Wax', d: '45 min · VAT incl.', p: 89 },
        ].map((s, i) => (
          <div key={i} style={{
            margin: '8px 16px 0', padding: '12px 14px', borderRadius: 14,
            background: s.picked ? fmb.mint : fmb.white,
            border: `1px solid ${s.picked ? fmb.primary : fmb.mintEdge}`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: 'rgba(255,255,255,0.7)', display: 'grid', placeItems: 'center', fontSize: 18,
            }}>{i === 0 ? '💦' : '✨'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: fmb.ink }}>{s.n}</div>
              <div style={{ fontSize: 11, color: fmb.inkSoft, marginTop: 2 }}>{s.d}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: fmb.primaryDeep }}>AED {s.p}</div>
          </div>
        ))}
      </div>
      {/* sticky CTA */}
      <div style={{ padding: '12px 16px 24px', background: fmb.cream }}>
        <button style={{
          width: '100%', height: 52, borderRadius: 14, border: 'none',
          background: fmb.primary, color: 'white',
          fontSize: 15, fontWeight: 600, letterSpacing: -0.2,
          boxShadow: '0 8px 20px rgba(20,184,166,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          Book a wash · AED 35
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M5 1l6 6-6 6" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
    </Phone>
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
    <Phone>
      <div style={{ padding: '0 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: fmb.white, border: `1px solid ${fmb.mintEdge}`, display: 'grid', placeItems: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 14 14"><path d="M9 1L3 7l6 6" stroke={fmb.ink} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: fmb.ink, letterSpacing: -0.3 }}>Pick a time</div>
      </div>

      {/* date picker */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: fmb.primaryDeep, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 6 }}>Date</div>
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
              <div style={{ fontSize: 10, opacity: 0.8 }}>{d.d}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{d.n}</div>
              <div style={{ fontSize: 9, opacity: d.sel ? 0.85 : 0.6, marginTop: 2, height: 10 }}>{d.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* time slots */}
      <div style={{ padding: '20px 16px 0', flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 6, paddingRight: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: fmb.primaryDeep, letterSpacing: 0.3, textTransform: 'uppercase' }}>Morning slots</div>
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
                fontSize: 14, fontWeight: 600,
                background: isSel ? fmb.primary : (isPast ? '#F1F1EE' : fmb.white),
                color: isSel ? 'white' : (isPast ? '#B7B7B0' : fmb.ink),
                border: `1px solid ${isSel ? fmb.primary : (isPast ? 'transparent' : fmb.mintEdge)}`,
                textDecoration: isPast ? 'line-through' : 'none',
                boxShadow: isSel ? '0 6px 14px rgba(20,184,166,0.3)' : 'none',
              }}>{t}</div>
            );
          })}
        </div>

        {/* summary */}
        <div style={{
          marginTop: 18, padding: 14, borderRadius: 14,
          background: fmb.sand, opacity: 0.95,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, color: fmb.primaryDeep, fontWeight: 600 }}>You'll get a smart-leave alert</div>
            <span style={{ fontSize: 16 }}>🚦</span>
          </div>
          <div style={{ fontSize: 11, color: fmb.ink, opacity: 0.7, marginTop: 4, lineHeight: 1.4 }}>
            We'll ping you when it's time to head out, factoring traffic.
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '12px 16px 24px' }}>
        <button style={{
          width: '100%', height: 52, borderRadius: 14, border: 'none',
          background: fmb.primary, color: 'white',
          fontSize: 15, fontWeight: 600, letterSpacing: -0.2,
          boxShadow: '0 8px 20px rgba(20,184,166,0.35)',
        }}>Confirm · Tue 10:00 · AED 35</button>
      </div>
    </Phone>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. Booking Confirmed
// ─────────────────────────────────────────────────────────────
function ScreenConfirmed() {
  return (
    <Phone>
      <div style={{ flex: 1, padding: '8px 22px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* check */}
        <div style={{ position: 'relative', marginTop: 18 }}>
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

        <div style={{ marginTop: 22, fontSize: 22, fontWeight: 700, color: fmb.ink, letterSpacing: -0.4 }}>You're all set!</div>
        <div style={{ marginTop: 6, fontSize: 12, color: fmb.inkSoft, textAlign: 'center', lineHeight: 1.5, padding: '0 12px' }}>
          We'll send a smart-leave alert so you arrive on time — even in traffic.
        </div>

        {/* receipt */}
        <div style={{
          marginTop: 22, width: '100%', background: fmb.white,
          borderRadius: 18, padding: '14px 16px',
          border: `1px solid ${fmb.mintEdge}`,
          boxShadow: '0 6px 20px rgba(11,59,54,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${fmb.mint}, ${fmb.sand})`, display: 'grid', placeItems: 'center', fontSize: 18 }}>🚿</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: fmb.ink }}>Polaris Auto Spa</div>
              <div style={{ fontSize: 10, color: fmb.inkSoft }}>Business Bay, Dubai</div>
            </div>
          </div>
          <div style={{ height: 1, background: fmb.hairline, margin: '12px -2px', position: 'relative' }}>
            <div style={{ position: 'absolute', left: -16, top: -8, width: 16, height: 16, borderRadius: '50%', background: fmb.cream }}/>
            <div style={{ position: 'absolute', right: -16, top: -8, width: 16, height: 16, borderRadius: '50%', background: fmb.cream }}/>
          </div>
          {[
            ['Service', 'Quick Exterior Wash'],
            ['Bay', 'Bay 1'],
            ['Time', 'Tue 28 Apr · 10:00'],
            ['Duration', '20 min'],
          ].map(([k, v], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
              <span style={{ fontSize: 11, color: fmb.inkSoft }}>{k}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: fmb.ink }}>{v}</span>
            </div>
          ))}
          <div style={{ height: 1, background: fmb.hairline, margin: '8px 0' }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: fmb.ink }}>Total</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: fmb.primaryDeep }}>AED 35</span>
          </div>
        </div>

        {/* add to calendar */}
        <div style={{
          marginTop: 12, width: '100%', display: 'flex', gap: 8,
        }}>
          <button style={{
            flex: 1, height: 44, borderRadius: 12,
            background: fmb.white, border: `1px solid ${fmb.mintEdge}`,
            color: fmb.ink, fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>📅 Add to calendar</button>
          <button style={{
            flex: 1, height: 44, borderRadius: 12,
            background: fmb.white, border: `1px solid ${fmb.mintEdge}`,
            color: fmb.ink, fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>🧭 Get directions</button>
        </div>

        <div style={{ flex: 1 }}/>
        <button style={{
          width: '100%', height: 52, borderRadius: 14, border: 'none',
          background: fmb.primary, color: 'white',
          fontSize: 15, fontWeight: 600, letterSpacing: -0.2,
          boxShadow: '0 8px 20px rgba(20,184,166,0.35)',
          marginBottom: 24,
        }}>Done</button>
      </div>
    </Phone>
  );
}

// ─────────────────────────────────────────────────────────────
// 7. Leave Now (the warm hero alert)
// ─────────────────────────────────────────────────────────────
function ScreenLeave() {
  return (
    <Phone bg={`linear-gradient(165deg, #2DD4BF 0%, #0F766E 75%, #0B3B36 100%)`} dark>
      {/* sand sun */}
      <div style={{ position: 'absolute', top: 50, left: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,199,126,0.45) 0%, rgba(245,199,126,0) 65%)' }}/>
      <div style={{ position: 'absolute', bottom: 100, right: -50, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,212,191,0.5) 0%, rgba(45,212,191,0) 60%)' }}/>

      <div style={{ flex: 1, padding: '12px 22px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 6 }}>Smart leave alert</div>

        <div style={{ position: 'relative', marginTop: 26 }}>
          <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', background: 'rgba(245,199,126,0.25)', animation: 'pulse 2s ease-in-out infinite' }}/>
          <div style={{
            position: 'relative', width: 80, height: 80, borderRadius: 26,
            background: `linear-gradient(160deg, ${fmb.sand}, ${fmb.sandDeep})`,
            display: 'grid', placeItems: 'center', fontSize: 42,
            boxShadow: '0 14px 32px rgba(0,0,0,0.25)',
          }}>🚗</div>
        </div>

        <div style={{ marginTop: 24, fontSize: 36, fontWeight: 800, color: 'white', letterSpacing: -1 }}>Leave now</div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 1.5 }}>
          Heading to <span style={{ fontWeight: 700, color: fmb.sand }}>Polaris Auto Spa</span><br/>
          for your <span style={{ fontWeight: 600 }}>10:00</span> wash
        </div>

        {/* glass card */}
        <div style={{
          marginTop: 28, width: '100%', borderRadius: 22,
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
          padding: 16, display: 'flex', alignItems: 'stretch',
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: fmb.inkSoft, fontWeight: 600 }}>Drive</div>
            <div style={{ marginTop: 4, fontSize: 30, fontWeight: 800, color: fmb.ink, letterSpacing: -1 }}>
              12<span style={{ fontSize: 13, fontWeight: 600, color: fmb.inkSoft, marginLeft: 2 }}>min</span>
            </div>
            <div style={{ fontSize: 10, color: fmb.coral, fontWeight: 700, marginTop: 2 }}>+3 traffic</div>
          </div>
          <div style={{ width: 1, background: fmb.hairline, margin: '4px 0' }}/>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: fmb.inkSoft, fontWeight: 600 }}>Slot</div>
            <div style={{ marginTop: 4, fontSize: 30, fontWeight: 800, color: fmb.primaryDeep, letterSpacing: -1 }}>10:00</div>
            <div style={{ fontSize: 10, color: fmb.inkSoft, marginTop: 2 }}>Bay 1 · Tue</div>
          </div>
        </div>

        <div style={{ flex: 1 }}/>

        <button style={{
          width: '100%', height: 56, borderRadius: 16, border: 'none',
          background: `linear-gradient(180deg, ${fmb.sand}, ${fmb.sandDeep})`,
          color: fmb.primaryDeep, fontSize: 16, fontWeight: 700,
          boxShadow: '0 12px 26px rgba(245,199,126,0.45)',
          letterSpacing: -0.3,
        }}>I'm leaving now</button>
        <button style={{
          width: '100%', height: 44, borderRadius: 12,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.35)',
          color: 'white', fontSize: 13, fontWeight: 500,
          marginTop: 8, marginBottom: 24,
        }}>Snooze 5 min</button>
      </div>
    </Phone>
  );
}

// ─────────────────────────────────────────────────────────────
// 8. My Bookings
// ─────────────────────────────────────────────────────────────
function ScreenBookings() {
  return (
    <Phone>
      <div style={{ padding: '0 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: fmb.ink, letterSpacing: -0.4 }}>My bookings</div>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: fmb.mint, display: 'grid', placeItems: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke={fmb.primaryDeep} strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
      </div>

      {/* tabs */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{
          display: 'flex', background: fmb.white,
          border: `1px solid ${fmb.mintEdge}`, borderRadius: 12, padding: 4,
        }}>
          {['Upcoming','Past'].map((t, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center', padding: '8px 0',
              fontSize: 12, fontWeight: 600,
              borderRadius: 9,
              background: i === 0 ? fmb.primary : 'transparent',
              color: i === 0 ? 'white' : fmb.inkSoft,
            }}>{t}</div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: '12px 16px 0', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* active card */}
        <div style={{
          background: fmb.white, borderRadius: 18, overflow: 'hidden',
          border: `1.5px solid ${fmb.primary}`,
          boxShadow: '0 8px 20px rgba(20,184,166,0.15)',
        }}>
          <div style={{
            background: `linear-gradient(90deg, ${fmb.mint} 0%, ${fmb.sand} 100%)`,
            padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: fmb.primaryDeep, letterSpacing: 0.3, textTransform: 'uppercase' }}>Tomorrow · 10:00</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: fmb.primaryDeep }}>in 18h 14m</span>
          </div>
          <div style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${fmb.mint}, ${fmb.sand})`, display: 'grid', placeItems: 'center', fontSize: 18 }}>🚿</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: fmb.ink }}>Polaris Auto Spa</div>
                <div style={{ fontSize: 10, color: fmb.inkSoft }}>Quick Wash · Bay 1</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: fmb.primaryDeep }}>AED 35</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button style={{
                flex: 1, height: 36, borderRadius: 10, border: 'none',
                background: fmb.primaryDeep, color: 'white',
                fontSize: 11, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                <svg width="11" height="11" viewBox="0 0 11 11"><rect x="0" y="0" width="4" height="4" fill="white"/><rect x="7" y="0" width="4" height="4" fill="white"/><rect x="0" y="7" width="4" height="4" fill="white"/><rect x="6" y="6" width="2" height="2" fill="white"/><rect x="9" y="9" width="2" height="2" fill="white"/></svg>
                Show QR
              </button>
              <button style={{
                flex: 1, height: 36, borderRadius: 10,
                background: fmb.white, border: `1px solid ${fmb.mintEdge}`,
                color: fmb.ink, fontSize: 11, fontWeight: 600,
              }}>Reschedule</button>
              <button style={{
                width: 36, height: 36, borderRadius: 10,
                background: fmb.white, border: `1px solid ${fmb.mintEdge}`,
                color: fmb.coral, fontSize: 14, fontWeight: 600,
              }}>×</button>
            </div>
          </div>
        </div>

        {/* upcoming card */}
        <div style={{ background: fmb.white, borderRadius: 18, padding: '12px 14px', border: `1px solid ${fmb.mintEdge}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 10, color: fmb.inkSoft, fontWeight: 600 }}>Sat 2 May · 14:30</div>
            <div style={{ fontSize: 9, color: fmb.primaryDeep, fontWeight: 700, background: fmb.mint, padding: '2px 8px', borderRadius: 6 }}>SCHEDULED</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${fmb.mint}, ${fmb.sand})`, display: 'grid', placeItems: 'center', fontSize: 18 }}>✨</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: fmb.ink }}>Marina Shine</div>
              <div style={{ fontSize: 10, color: fmb.inkSoft }}>Premium Wash · Bay 2</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: fmb.primaryDeep }}>AED 89</div>
          </div>
        </div>

        {/* loyalty teaser */}
        <div style={{
          background: `linear-gradient(135deg, ${fmb.sand} 0%, #FFE3D9 100%)`,
          borderRadius: 18, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 28 }}>🎁</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: fmb.ink }}>One free wash on us</div>
            <div style={{ fontSize: 10, color: fmb.inkSoft, marginTop: 2 }}>3 of 5 washes complete</div>
            <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)', overflow: 'hidden' }}>
              <div style={{ width: '60%', height: '100%', background: fmb.primary }}/>
            </div>
          </div>
        </div>
      </div>
      <div style={{ height: 24 }}/>
    </Phone>
  );
}

// ─────────────────────────────────────────────────────────────
Object.assign(window, {
  Phone, AppIcon, LogoMark, fmb,
  ScreenOTP, ScreenVerify, ScreenMap, ScreenVendor,
  ScreenSlot, ScreenConfirmed, ScreenLeave, ScreenBookings,
});
