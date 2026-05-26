// findMy Bay — Attendant App (Android, 390x844)
// 5 hi-fi screens for the wash-floor staff app.
// Brand: aqua / deep-teal / cream / mint / sand. M1 marker logo (no "P", no drop).
// UX: 60dp+ targets, bottom-third primaries, big numerics, status by color.

const fmb = {
  primary:    '#14B8A6',
  primaryDeep:'#0F766E',
  ink:        '#0B3B36',
  inkSoft:    '#5C7A75',
  cream:      '#FFF7EC',
  mint:       '#E6F7F4',
  mintEdge:   '#CDEEE8',
  sand:       '#FCE7C8',
  sandDeep:   '#F5C77E',
  coral:      '#FF8B6B',
  coralSoft:  '#FFE3D9',
  white:      '#FFFFFF',
};

// ───────────────────────────────────────────────────────────
// M1 Marker logo (the new corporate mark — squircle + droplet w/ aperture)
// ───────────────────────────────────────────────────────────
function M1Mark({ size = 28, bg = fmb.primaryDeep, fg = fmb.cream }) {
  const id = `m1-${Math.random().toString(36).slice(2,8)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
      <defs>
        <mask id={id}>
          <rect width="100" height="100" fill="#fff"/>
          <circle cx="50" cy="58" r="14" fill="#000"/>
        </mask>
      </defs>
      <rect width="100" height="100" rx="22" fill={bg}/>
      <path d="M50 14 C50 14 22 46 22 66 C22 81 35 90 50 90 C65 90 78 81 78 66 C78 46 50 14 50 14 Z"
            fill={fg} mask={`url(#${id})`}/>
    </svg>
  );
}

// ───────────────────────────────────────────────────────────
// Android-style phone frame · 390 × 844 (matches brief)
// ───────────────────────────────────────────────────────────
function Phone({ children, bg = fmb.cream, dark = false }) {
  return (
    <div style={{
      width: 390, height: 844,
      borderRadius: 44,
      overflow: 'hidden',
      position: 'relative',
      background: bg,
      boxShadow: '0 30px 80px rgba(11,59,54,0.22), 0 0 0 10px #1a1a1a, 0 0 0 11px #333',
      fontFamily: '"Plus Jakarta Sans", -apple-system, system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Status bar — Android, dark glyphs */}
      <div style={{
        height: 32, paddingTop: 10, paddingLeft: 24, paddingRight: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
        color: dark ? fmb.cream : fmb.ink,
        position: 'relative', zIndex: 10,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2 }}>09:41</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* signal */}
          <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor">
            <rect x="0"  y="8"  width="2.5" height="3"  rx="0.5"/>
            <rect x="3.5" y="6" width="2.5" height="5"  rx="0.5"/>
            <rect x="7"  y="3" width="2.5" height="8"  rx="0.5"/>
            <rect x="10.5" y="0" width="2.5" height="11" rx="0.5"/>
          </svg>
          {/* wifi */}
          <svg width="14" height="11" viewBox="0 0 16 12">
            <path d="M8 3.2C10.2 3.2 12.2 4 13.6 5.4L14.7 4.3C12.9 2.5 10.5 1.4 8 1.4C5.5 1.4 3.1 2.5 1.3 4.3L2.4 5.4C3.8 4 5.8 3.2 8 3.2Z" fill="currentColor"/>
            <path d="M8 6.5C9.3 6.5 10.5 7 11.4 7.9L12.5 6.8C11.3 5.6 9.7 4.9 8 4.9C6.3 4.9 4.7 5.6 3.5 6.8L4.6 7.9C5.5 7 6.7 6.5 8 6.5Z" fill="currentColor"/>
            <circle cx="8" cy="10" r="1.4" fill="currentColor"/>
          </svg>
          {/* battery */}
          <svg width="24" height="11" viewBox="0 0 26 12">
            <rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.45"/>
            <rect x="2" y="2" width="18" height="8" rx="2" fill="currentColor"/>
            <rect x="23" y="3.5" width="1.5" height="5" rx="0.7" fill="currentColor" opacity="0.45"/>
          </svg>
        </div>
      </div>
      {/* Body */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      {/* Gesture bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 24,
        display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
        paddingBottom: 8, pointerEvents: 'none', zIndex: 12,
      }}>
        <div style={{
          width: 134, height: 4, borderRadius: 4,
          background: dark ? 'rgba(255,247,236,0.85)' : 'rgba(11,59,54,0.32)',
        }}/>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Shared bits
// ───────────────────────────────────────────────────────────
function Eyebrow({ children, color = fmb.primaryDeep, style }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
      textTransform: 'uppercase', color, ...style,
    }}>{children}</div>
  );
}

function StatusPill({ kind = 'free', text, sub, big = false }) {
  const map = {
    free:    { bg: fmb.mint,     color: fmb.primaryDeep, dot: fmb.primary },
    busy:    { bg: fmb.sand,     color: '#7A4D12',       dot: fmb.sandDeep },
    closed:  { bg: '#E8E8E3',    color: '#7A7A75',       dot: '#A8A8A0' },
    alert:   { bg: fmb.coralSoft,color: fmb.coral,       dot: fmb.coral },
    in:      { bg: fmb.primary,  color: fmb.white,       dot: fmb.white },
    done:    { bg: fmb.mint,     color: fmb.primaryDeep, dot: fmb.primary },
  };
  const c = map[kind] || map.free;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: c.bg, color: c.color,
      padding: big ? '6px 12px' : '4px 9px',
      borderRadius: 6,
      fontSize: big ? 12 : 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }}/>
      {text}{sub && <span style={{ fontWeight:700, opacity:0.85 }}>· {sub}</span>}
    </span>
  );
}

function TierBadge({ tier = 'Gold' }) {
  const cfg = {
    Bronze:   { bg: 'linear-gradient(120deg,#D9A56A,#A06A2E)', color: '#fff' },
    Silver:   { bg: 'linear-gradient(120deg,#D4DBDD,#9CA8AB)', color: '#3A4244' },
    Gold:     { bg: `linear-gradient(120deg,${fmb.sand},${fmb.sandDeep})`, color: '#7A4D12' },
    Platinum: { bg: `linear-gradient(120deg,${fmb.mint},${fmb.primary})`,  color: fmb.primaryDeep },
  }[tier];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: cfg.bg, color: cfg.color,
      padding: '3px 9px', borderRadius: 999,
      fontSize: 10, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase',
    }}>★ {tier}</span>
  );
}

// Icons (Lucide-style outline, currentColor)
const Icons = {
  Info:    (p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
  Logout:  (p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  Back:    (p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15 18l-6-6 6-6"/></svg>,
  Filter:  (p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 3H2l8 9.5V19l4 2v-8.5z"/></svg>,
  Clock:   (p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  Plus:    (p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  Cam:     (p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  List:    (p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>,
  X:       (p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6L6 18M6 6l12 12"/></svg>,
  Check:   (p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 13l4 4L19 7"/></svg>,
  Chev:    (p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 18l6-6-6-6"/></svg>,
  Swap:    (p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/></svg>,
  Phone:   (p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.33 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg>,
  Plug:    (p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22v-5M9 7V2M15 7V2M5 10V8a2 2 0 012-2h10a2 2 0 012 2v2a6 6 0 01-6 6h-2a6 6 0 01-6-6z"/></svg>,
  Drop:    (p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 2.69l5.66 5.66a8 8 0 11-11.32 0z"/></svg>,
};

Object.assign(window, { fmb, M1Mark, Phone, Eyebrow, StatusPill, TierBadge, Icons });
