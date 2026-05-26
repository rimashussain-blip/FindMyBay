// findMy Bay — Attendant App · 5 hi-fi screens
// All at 390×844. Realistic UAE names + cars throughout.

const { fmb, M1Mark, Phone, Eyebrow, StatusPill, TierBadge, Icons } = window;

// ───────────────────────────────────────────────────────────
// Sticky header (logo + vendor + info/sign-out)
// ───────────────────────────────────────────────────────────
function StickyHeader({ title = 'Aqua Car Wash', sub = 'Business Bay · Open' }) {
  return (
    <div style={{
      padding: '14px 20px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      background: fmb.cream,
      borderBottom: `1px solid ${fmb.mintEdge}`,
      flexShrink: 0,
    }}>
      <M1Mark size={36}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: fmb.ink, letterSpacing: -0.3, lineHeight: 1.15 }}>{title}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: fmb.primaryDeep, letterSpacing: 0.2, display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: fmb.primary, flexShrink: 0 }}/>{sub}
        </div>
      </div>
      <button style={{ width: 36, height: 36, borderRadius: 12, border: `1px solid ${fmb.mintEdge}`, background: fmb.white, color: fmb.inkSoft, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
        <Icons.Info width="18" height="18"/>
      </button>
      <button style={{ width: 36, height: 36, borderRadius: 12, border: `1px solid ${fmb.mintEdge}`, background: fmb.white, color: fmb.inkSoft, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
        <Icons.Logout width="17" height="17"/>
      </button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Countdown ring (for busy bay tiles)
// ───────────────────────────────────────────────────────────
function CountdownRing({ pct = 0.65, size = 56 }) {
  const r = (size - 6) / 2;
  const C = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={fmb.sand} strokeWidth="4"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={fmb.sandDeep} strokeWidth="4"
                strokeDasharray={`${C*pct} ${C}`} strokeDashoffset={C*0.25} strokeLinecap="round"
                transform={`rotate(-90 ${size/2} ${size/2})`}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#7A4D12' }}>
        <Icons.Clock width="20" height="20"/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SCREEN 1 — BAY BOARD (home)
// State: Bay 2 mid-wash (Khalid, Deep Clean, 8 min left). Bay 3 free. Bay 4 closed.
// ═══════════════════════════════════════════════════════════
function Screen1_BayBoard() {
  const BAYS = [
    { id: 1, name: 'Bay 1', state: 'free' },
    { id: 2, name: 'Bay 2', state: 'busy', customer: 'Khalid', service: 'Deep Clean', remain: 8, pct: 0.65 },
    { id: 3, name: 'Bay 3', state: 'free' },
    { id: 4, name: 'Bay 4', state: 'closed' },
  ];
  const UP_NEXT = [
    { time: '10:30', name: 'Hessa Al Mansoori', tier: 'Gold',    service: 'Full Wash',    bay: 'Bay 1' },
    { time: '10:45', name: 'Omar Rashid',        tier: 'Silver',  service: 'Premium Detail', bay: 'Bay 3' },
  ];
  return (
    <Phone>
      {/* Legend (commented to UI as eyebrow above bays) */}
      <StickyHeader/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 140px' }}>
        {/* Bays */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <Eyebrow>Bays · 4 total</Eyebrow>
          <span style={{ fontSize: 11, color: fmb.inkSoft, fontWeight: 600 }}>2 free · 1 busy · 1 closed</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {BAYS.map(b => {
            const busy = b.state === 'busy';
            const closed = b.state === 'closed';
            const tile = {
              free:   { bg: fmb.white,    border: fmb.primary,  ink: fmb.ink },
              busy:   { bg: fmb.white,    border: fmb.sandDeep, ink: fmb.ink },
              closed: { bg: '#F0EFEA',    border: '#D5D3CC',    ink: '#9C9A92' },
            }[b.state];
            return (
              <div key={b.id} style={{
                background: tile.bg,
                border: `1.5px solid ${tile.border}`,
                borderRadius: 16,
                padding: 14,
                height: 168,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                boxShadow: closed ? 'none' : '0 4px 14px rgba(15,118,110,0.06)',
                position: 'relative',
              }}>
                {/* top row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: tile.ink, letterSpacing: -0.5, lineHeight: 1 }}>{b.name}</div>
                  {busy && <CountdownRing pct={b.pct}/>}
                </div>
                {/* mid — customer */}
                {busy && (
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: fmb.ink, letterSpacing: -0.4, lineHeight: 1 }}>{b.customer}</div>
                    <div style={{ fontSize: 12, color: fmb.inkSoft, fontWeight: 600, marginTop: 4 }}>{b.service}</div>
                  </div>
                )}
                {closed && (
                  <div style={{ fontSize: 12, color: '#9C9A92', fontWeight: 600 }}>Maintenance until 12:00</div>
                )}
                {/* bottom — pill */}
                <div>
                  {b.state === 'free' && <StatusPill kind="free" text="Free"/>}
                  {b.state === 'busy' && <StatusPill kind="busy" text="Busy" sub={`${b.remain} min`}/>}
                  {b.state === 'closed' && <StatusPill kind="closed" text="Closed"/>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Up next */}
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <Eyebrow>Up next · 2</Eyebrow>
          <span style={{ fontSize: 11, color: fmb.primaryDeep, fontWeight: 700 }}>See all</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {UP_NEXT.map((u, i) => (
            <div key={i} style={{
              background: fmb.white,
              border: `1.5px solid ${fmb.mintEdge}`,
              borderRadius: 16,
              padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 4px 14px rgba(15,118,110,0.06)',
            }}>
              <div style={{ background: fmb.sand, color: '#7A4D12', fontSize: 14, fontWeight: 800, padding: '6px 11px', borderRadius: 10, letterSpacing: -0.2, flexShrink: 0 }}>{u.time}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: fmb.ink, letterSpacing: -0.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.name}</span>
                  <TierBadge tier={u.tier}/>
                </div>
                <div style={{ fontSize: 12, color: fmb.inkSoft, fontWeight: 600, marginTop: 3 }}>{u.service} · {u.bay}</div>
              </div>
              <Icons.Chev width="18" height="18" style={{ color: fmb.inkSoft, flexShrink: 0 }}/>
            </div>
          ))}
        </div>
      </div>

      {/* Floating action bar */}
      <div style={{
        position: 'absolute', bottom: 24, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 14,
        padding: '0 20px',
      }}>
        <button style={{
          flex: 1, height: 64, borderRadius: 18,
          background: fmb.primaryDeep, color: fmb.white,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 14, fontWeight: 800, letterSpacing: -0.2,
          boxShadow: '0 10px 24px rgba(15,118,110,0.45)',
        }}>
          <Icons.Plus width="20" height="20"/> Walk-in
        </button>
        <button style={{
          width: 64, height: 64, borderRadius: 18,
          background: fmb.white, color: fmb.primaryDeep,
          border: `1.5px solid ${fmb.mintEdge}`, cursor: 'pointer',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 6px 16px rgba(11,59,54,0.08)',
        }}>
          <Icons.Cam width="22" height="22"/>
        </button>
        <button style={{
          width: 64, height: 64, borderRadius: 18,
          background: fmb.white, color: fmb.primaryDeep,
          border: `1.5px solid ${fmb.mintEdge}`, cursor: 'pointer',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 6px 16px rgba(11,59,54,0.08)',
        }}>
          <Icons.List width="22" height="22"/>
        </button>
      </div>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════
// SCREEN 2 — ALL BOOKINGS (list)
// State: Today tab; second card swiped left revealing green check-in action.
// ═══════════════════════════════════════════════════════════
function Screen2_Bookings() {
  const ROWS = [
    { time: '09:30', name: 'Khalid Saeed',    tier: 'Platinum', service: 'Deep Clean',     dur: '90 min', bay: 'Bay 2', status: 'in',  swipe: false },
    { time: '10:30', name: 'Hessa Al Mansoori', tier: 'Gold',   service: 'Full Wash',      dur: '45 min', bay: 'Bay 1', status: 'alert', swipe: true  },
    { time: '10:45', name: 'Omar Rashid',     tier: 'Silver',   service: 'Premium Detail', dur: '180 min',bay: 'Bay 3', status: 'free' },
    { time: '11:30', name: 'Mariam Yousef',   tier: 'Gold',     service: 'Full Wash',      dur: '45 min', bay: 'Bay 1', status: 'free' },
    { time: '12:00', name: 'Tariq Bin Saif',  tier: 'Bronze',   service: 'Quick Wash',     dur: '20 min', bay: 'Bay 3', status: 'free' },
    { time: '08:30', name: 'Layla Hassan',    tier: 'Gold',     service: 'Quick Wash',     dur: '20 min', bay: 'Bay 1', status: 'done' },
  ];
  const statusFor = (s, name) => {
    if (s === 'in')    return <StatusPill kind="in"    text="In Progress"/>;
    if (s === 'alert') return <StatusPill kind="alert" text="Alerted"/>;
    if (s === 'done')  return <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:fmb.mint, color:fmb.primaryDeep, padding:'4px 9px', borderRadius:6, fontSize:11, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase' }}><Icons.Check width="11" height="11"/> Completed</span>;
    return <StatusPill kind="free" text="Confirmed"/>;
  };

  return (
    <Phone>
      {/* Header */}
      <div style={{ padding:'14px 20px 12px', display:'flex', alignItems:'center', gap:10, background:fmb.cream, borderBottom:`1px solid ${fmb.mintEdge}`, flexShrink:0 }}>
        <button style={{ width:36, height:36, borderRadius:12, border:`1px solid ${fmb.mintEdge}`, background:fmb.white, color:fmb.ink, display:'grid', placeItems:'center', cursor:'pointer' }}>
          <Icons.Back width="18" height="18"/>
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:20, fontWeight:800, color:fmb.ink, letterSpacing:-0.4 }}>Bookings</div>
        </div>
        <button style={{ width:36, height:36, borderRadius:12, border:`1px solid ${fmb.mintEdge}`, background:fmb.white, color:fmb.inkSoft, display:'grid', placeItems:'center', cursor:'pointer' }}>
          <Icons.Filter width="17" height="17"/>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ padding:'12px 20px 0', flexShrink:0 }}>
        <div style={{ display:'flex', background:fmb.mint, border:`1px solid ${fmb.mintEdge}`, borderRadius:14, padding:4 }}>
          {[['Today', 6], ['Upcoming', 12], ['Completed', 24]].map(([t,n],i) => (
            <button key={t} style={{
              flex:1, height:40, borderRadius:11, border:'none', cursor:'pointer',
              background: i===0 ? fmb.primary : 'transparent',
              color:     i===0 ? fmb.white   : fmb.primaryDeep,
              fontSize:13, fontWeight:700, letterSpacing:-0.1,
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              fontFamily:'inherit',
            }}>
              {t}
              <span style={{ fontSize:10, fontWeight:800, background:i===0?'rgba(255,255,255,0.22)':fmb.white, color:i===0?fmb.white:fmb.primaryDeep, padding:'1px 6px', borderRadius:5 }}>{n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Pull-to-refresh */}
      <div style={{ padding:'10px 0 4px', display:'flex', justifyContent:'center', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, color:fmb.inkSoft, fontSize:10, fontWeight:600 }}>
          <div style={{ width:14, height:14, border:`1.6px solid ${fmb.mintEdge}`, borderTopColor:fmb.primary, borderRadius:'50%' }}/>
          Pull to refresh
        </div>
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:'auto', padding:'4px 20px 32px', display:'flex', flexDirection:'column', gap:10 }}>
        {ROWS.map((r,i) => (
          <div key={i} style={{ position:'relative' }}>
            {/* Swipe-revealed action */}
            {r.swipe && (
              <div style={{
                position:'absolute', inset:0,
                background:fmb.primary, borderRadius:16,
                display:'flex', alignItems:'center', justifyContent:'flex-end',
                paddingRight:22, color:fmb.white, gap:8,
              }}>
                <span style={{ fontSize:12, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase' }}>Check in</span>
                <Icons.Check width="22" height="22"/>
              </div>
            )}
            {/* Card */}
            <div style={{
              background: r.status==='done' ? '#F7F4EC' : fmb.white,
              border: `1.5px solid ${r.status==='in' ? fmb.primary : fmb.mintEdge}`,
              borderRadius: 16,
              padding: '12px 14px',
              display:'flex', alignItems:'center', gap:12,
              boxShadow: '0 4px 14px rgba(15,118,110,0.05)',
              transform: r.swipe ? 'translateX(-78px)' : 'none',
              opacity: r.status==='done' ? 0.78 : 1,
              position:'relative',
              transition:'transform 0.2s',
            }}>
              <div style={{ background:fmb.sand, color:'#7A4D12', fontSize:13, fontWeight:800, padding:'6px 10px', borderRadius:10, flexShrink:0, letterSpacing:-0.2 }}>{r.time}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <span style={{ fontSize:15, fontWeight:700, color:fmb.ink, letterSpacing:-0.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:140 }}>{r.name}</span>
                  <TierBadge tier={r.tier}/>
                </div>
                <div style={{ fontSize:12, color:fmb.inkSoft, fontWeight:600, marginTop:3 }}>{r.service} · {r.dur} · {r.bay}</div>
              </div>
              <div style={{ flexShrink:0 }}>{statusFor(r.status, r.name)}</div>
            </div>
          </div>
        ))}
      </div>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════
// SCREEN 3 — QR SCANNER
// State: live scanner. Brackets pulsing. Dashboard illustration behind.
// ═══════════════════════════════════════════════════════════
function Screen3_Scanner() {
  return (
    <Phone bg="#0B1715" dark>
      {/* Stylised dashboard scene behind the camera */}
      <div style={{ position:'absolute', inset:0, overflow:'hidden' }}>
        {/* Sky/cabin gradient */}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,#13302B 0%,#0B1715 60%,#000 100%)' }}/>
        {/* Dashboard top edge */}
        <svg width="390" height="844" viewBox="0 0 390 844" style={{ position:'absolute', inset:0 }}>
          {/* Windshield horizon */}
          <path d="M0 360 Q195 260 390 360 L390 480 L0 480 Z" fill="#1B3D38"/>
          {/* Sun */}
          <circle cx="300" cy="290" r="36" fill="rgba(245,199,126,0.4)"/>
          <circle cx="300" cy="290" r="18" fill="rgba(245,199,126,0.7)"/>
          {/* Dashboard slab */}
          <path d="M0 480 L390 480 L390 720 Q195 760 0 720 Z" fill="#0E211E"/>
          {/* Steering wheel suggestion */}
          <circle cx="200" cy="780" r="120" fill="none" stroke="#15302C" strokeWidth="18"/>
          <circle cx="200" cy="780" r="100" fill="none" stroke="#13302B" strokeWidth="2"/>
          {/* Phone outline floating over dash — top-right */}
          <g transform="translate(245 540)">
            <rect width="78" height="140" rx="11" fill="#0a1715" stroke="#1f3b36" strokeWidth="1.5"/>
            <rect x="4" y="4" width="70" height="132" rx="7" fill="#142F2A"/>
            <rect x="12" y="14" width="54" height="40" rx="6" fill={fmb.mint} opacity="0.18"/>
            <rect x="12" y="60" width="54" height="6" rx="3" fill={fmb.primary} opacity="0.4"/>
            <rect x="12" y="70" width="40" height="6" rx="3" fill={fmb.primary} opacity="0.3"/>
            {/* QR squares */}
            <g transform="translate(20 88)">
              <rect width="38" height="38" fill="#fff" opacity="0.85"/>
              <rect x="2" y="2" width="8" height="8" fill="#000"/>
              <rect x="28" y="2" width="8" height="8" fill="#000"/>
              <rect x="2" y="28" width="8" height="8" fill="#000"/>
              <rect x="14" y="14" width="4" height="4" fill="#000"/>
              <rect x="20" y="14" width="4" height="4" fill="#000"/>
              <rect x="14" y="20" width="4" height="4" fill="#000"/>
            </g>
          </g>
          {/* Hand silhouette holding it */}
          <path d="M255 660 Q210 700 175 760 Q240 750 290 720 Q330 700 340 660 Z" fill="#0a1715" opacity="0.85"/>
        </svg>
        {/* Vignette */}
        <div style={{ position:'absolute', inset:0, boxShadow:'inset 0 0 120px rgba(0,0,0,0.6)' }}/>
      </div>

      {/* Top overlay */}
      <div style={{ position:'absolute', top:32, left:0, right:0, padding:'14px 20px', zIndex:5 }}>
        <div style={{
          background:'rgba(11,23,21,0.78)', backdropFilter:'blur(8px)',
          borderRadius:18, padding:'14px 16px',
          border:'1px solid rgba(94,234,212,0.18)',
          display:'flex', alignItems:'center', gap:12,
        }}>
          <div style={{ flex:1 }}>
            <Eyebrow style={{ color:fmb.primary }}>Scan customer QR</Eyebrow>
            <div style={{ fontSize:14, fontWeight:700, color:fmb.cream, marginTop:3, letterSpacing:-0.2 }}>Hold the customer's QR steady</div>
          </div>
          <button style={{ width:40, height:40, borderRadius:12, border:'1px solid rgba(255,247,236,0.2)', background:'rgba(255,247,236,0.08)', color:fmb.cream, display:'grid', placeItems:'center', cursor:'pointer' }}>
            <Icons.X width="18" height="18"/>
          </button>
        </div>
      </div>

      {/* Scan zone */}
      <div style={{
        position:'absolute', top:'46%', left:'50%',
        transform:'translate(-50%,-50%)',
        width:240, height:240,
        zIndex:4,
      }}>
        <div style={{
          position:'absolute', inset:0,
          background:`radial-gradient(circle, ${fmb.primary}25 0%, transparent 70%)`,
        }}/>
        {/* Corners */}
        {[
          { t: 0, l: 0, r: ['M0 32 L0 0 L32 0',] },
          { t: 0, r: 0, r2: true,  d: 'M0 0 L32 0 L32 32' },
          { b: 0, l: 0, d: 'M0 0 L0 32 L32 32' },
          { b: 0, r: 0, d: 'M32 0 L32 32 L0 32' },
        ].map((c,i) => (
          <svg key={i} width="44" height="44" viewBox="0 0 32 32" style={{
            position:'absolute',
            top: c.t === 0 ? 0 : 'auto',
            bottom: c.b === 0 ? 0 : 'auto',
            left: c.l === 0 ? 0 : 'auto',
            right: c.r === 0 ? 0 : 'auto',
          }}>
            {i===0 && <path d="M0 32 L0 0 L32 0" stroke={fmb.primary} strokeWidth="4" fill="none" strokeLinecap="round"/>}
            {i===1 && <path d="M0 0 L32 0 L32 32" stroke={fmb.primary} strokeWidth="4" fill="none" strokeLinecap="round"/>}
            {i===2 && <path d="M0 0 L0 32 L32 32" stroke={fmb.primary} strokeWidth="4" fill="none" strokeLinecap="round"/>}
            {i===3 && <path d="M32 0 L32 32 L0 32" stroke={fmb.primary} strokeWidth="4" fill="none" strokeLinecap="round"/>}
          </svg>
        ))}
        {/* Scanning bar */}
        <div style={{
          position:'absolute', top:'50%', left:8, right:8, height:2,
          background:fmb.primary, boxShadow:`0 0 12px ${fmb.primary}`, borderRadius:1,
        }}/>
      </div>

      {/* Bottom overlay */}
      <div style={{ position:'absolute', bottom:48, left:0, right:0, padding:'0 20px', zIndex:5 }}>
        <div style={{
          background:'rgba(11,23,21,0.78)', backdropFilter:'blur(8px)',
          borderRadius:18, padding:'16px',
          border:'1px solid rgba(94,234,212,0.18)',
          display:'flex', flexDirection:'column', gap:12,
        }}>
          <button style={{
            width:'100%', height:60, borderRadius:14,
            background:'transparent', color:fmb.cream,
            border:`1.5px solid rgba(255,247,236,0.4)`, cursor:'pointer',
            fontSize:15, fontWeight:700, letterSpacing:-0.2, fontFamily:'inherit',
          }}>
            Type code instead
          </button>
          <div style={{ fontSize:11, color:'rgba(255,247,236,0.55)', textAlign:'center', fontWeight:500 }}>
            If the QR won't scan, ask the customer to read it
          </div>
        </div>
      </div>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════
// SCREEN 4 — WALK-IN ENTRY
// State: Bay 3 selected (SUV). Deep Clean service selected.
//        Optional details accordion closed.
// ═══════════════════════════════════════════════════════════
function Screen4_Walkin() {
  return (
    <Phone>
      {/* Header */}
      <div style={{ padding:'14px 20px 12px', display:'flex', alignItems:'center', gap:10, background:fmb.cream, borderBottom:`1px solid ${fmb.mintEdge}`, flexShrink:0 }}>
        <button style={{ width:36, height:36, borderRadius:12, border:`1px solid ${fmb.mintEdge}`, background:fmb.white, color:fmb.ink, display:'grid', placeItems:'center', cursor:'pointer' }}>
          <Icons.Back width="18" height="18"/>
        </button>
        <div style={{ flex:1 }}>
          <Eyebrow style={{ color:fmb.primaryDeep, marginBottom:2 }}>Started now · 09:41</Eyebrow>
          <div style={{ fontSize:20, fontWeight:800, color:fmb.ink, letterSpacing:-0.4 }}>New walk-in</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 20px 130px', display:'flex', flexDirection:'column', gap:22 }}>
        {/* Bay */}
        <div>
          <Eyebrow style={{ marginBottom: 10 }}>1 · Pick a bay</Eyebrow>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[
              { name:'Bay 1', type:'Sedan', sel:false },
              { name:'Bay 2', type:'Sedan', sel:false, busy:true },
              { name:'Bay 3', type:'SUV',   sel:true  },
            ].map(b => (
              <button key={b.name} disabled={b.busy} style={{
                height:60, padding:'0 16px', borderRadius:14,
                border: b.sel ? `2px solid ${fmb.primary}` : `1.5px solid ${b.busy?fmb.mintEdge:fmb.mintEdge}`,
                background: b.sel ? fmb.mint : (b.busy ? '#F2EFE8' : fmb.white),
                opacity: b.busy ? 0.55 : 1,
                cursor: b.busy ? 'not-allowed' : 'pointer',
                display:'flex', flexDirection:'column', alignItems:'flex-start', gap:2,
                fontFamily:'inherit',
              }}>
                <div style={{ fontSize:14, fontWeight:800, color:fmb.ink, letterSpacing:-0.2 }}>{b.name}</div>
                <div style={{ fontSize:10, fontWeight:700, color: b.busy ? fmb.coral : fmb.primaryDeep, letterSpacing:0.3, textTransform:'uppercase' }}>
                  {b.busy ? 'Busy' : 'Free'} · {b.type}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Service */}
        <div>
          <Eyebrow style={{ marginBottom: 10 }}>2 · Choose a service</Eyebrow>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { name:'Quick Wash',     min:20,  price:50,  sel:false },
              { name:'Full Wash',      min:45,  price:100, sel:false },
              { name:'Deep Clean',     min:90,  price:200, sel:true  },
              { name:'Premium Detail', min:180, price:450, sel:false },
            ].map(s => (
              <button key={s.name} style={{
                width:'100%', height:64, padding:'0 16px', borderRadius:14,
                border: s.sel ? `2px solid ${fmb.primary}` : `1.5px solid ${fmb.mintEdge}`,
                background: s.sel ? fmb.mint : fmb.white,
                cursor:'pointer',
                display:'flex', alignItems:'center', gap:12,
                fontFamily:'inherit', textAlign:'left',
              }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:800, color:fmb.ink, letterSpacing:-0.2 }}>{s.name}</div>
                  <div style={{ fontSize:11, fontWeight:600, color:fmb.inkSoft, marginTop:3 }}>{s.min} min</div>
                </div>
                <div style={{ display:'flex', alignItems:'baseline', gap:3 }}>
                  <span style={{ fontSize:10, fontWeight:700, color:fmb.inkSoft }}>AED</span>
                  <span style={{ fontSize:18, fontWeight:800, color:fmb.ink, letterSpacing:-0.4, fontFamily:'"DM Sans",system-ui' }}>{s.price}</span>
                </div>
                {s.sel && (
                  <div style={{ width:24, height:24, borderRadius:'50%', background:fmb.primary, display:'grid', placeItems:'center', color:fmb.white, flexShrink:0 }}>
                    <Icons.Check width="14" height="14"/>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Optional details accordion */}
        <div>
          <button style={{
            width:'100%', height:60, padding:'0 16px', borderRadius:14,
            border:`1.5px dashed ${fmb.mintEdge}`, background:'transparent',
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between',
            fontFamily:'inherit',
          }}>
            <div style={{ textAlign:'left' }}>
              <Eyebrow style={{ marginBottom:2 }}>3 · Optional</Eyebrow>
              <div style={{ fontSize:13, fontWeight:700, color:fmb.ink }}>Add name & phone</div>
            </div>
            <Icons.Plus width="20" height="20" style={{ color:fmb.primaryDeep }}/>
          </button>
        </div>
      </div>

      {/* CTA */}
      <div style={{ position:'absolute', bottom:24, left:0, right:0, padding:'0 16px' }}>
        <button style={{
          width:'100%', height:64, borderRadius:18,
          background:`linear-gradient(135deg,${fmb.primary},${fmb.primaryDeep})`,
          color:fmb.white, border:'none', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:10,
          fontSize:16, fontWeight:800, letterSpacing:-0.3, fontFamily:'inherit',
          boxShadow:'0 12px 28px rgba(15,118,110,0.5)',
        }}>
          Start now <span style={{ opacity:0.5 }}>·</span>
          <span>AED <span style={{ fontFamily:'"DM Sans",system-ui', fontSize:18 }}>200</span></span>
          <Icons.Chev width="20" height="20" style={{ marginLeft:2 }}/>
        </button>
      </div>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════
// SCREEN 5 — BOOKING DETAIL (slide-up sheet)
// State: Hessa's confirmed booking. AQUA10 promo applied. Primary action: Check in.
// ═══════════════════════════════════════════════════════════
function Screen5_Detail() {
  return (
    <Phone>
      {/* Dimmed bay-board behind */}
      <StickyHeader/>
      <div style={{ flex:1, padding:'18px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, opacity:0.32, pointerEvents:'none' }}>
        {['Bay 1','Bay 2','Bay 3','Bay 4'].map(n => (
          <div key={n} style={{ background:fmb.white, border:`1.5px solid ${fmb.primary}`, borderRadius:16, height:148 }}/>
        ))}
      </div>
      {/* Dim overlay */}
      <div style={{ position:'absolute', inset:0, background:'rgba(11,59,54,0.5)', zIndex:5 }}/>

      {/* Sheet */}
      <div style={{
        position:'absolute', left:0, right:0, bottom:0,
        height:'88%',
        background:fmb.cream, borderRadius:'28px 28px 0 0',
        boxShadow:'0 -12px 40px rgba(11,59,54,0.25)',
        display:'flex', flexDirection:'column',
        zIndex:10, overflow:'hidden',
      }}>
        {/* Grab handle */}
        <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 4px' }}>
          <div style={{ width:44, height:5, borderRadius:5, background:fmb.mintEdge }}/>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'8px 20px 16px' }}>
          {/* Customer card */}
          <div style={{
            background:fmb.white, border:`1.5px solid ${fmb.primary}40`,
            borderRadius:18, overflow:'hidden',
            boxShadow:'0 4px 14px rgba(15,118,110,0.06)',
          }}>
            {/* Mint→sand gradient header strip */}
            <div style={{
              background:`linear-gradient(90deg,${fmb.mint},${fmb.sand})`,
              padding:'10px 16px',
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <Eyebrow style={{ color:fmb.primaryDeep }}>Booking · 10:30 today</Eyebrow>
              <TierBadge tier="Gold"/>
            </div>
            <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:52, height:52, borderRadius:16, background:fmb.primaryDeep, color:fmb.cream, display:'grid', placeItems:'center', fontSize:18, fontWeight:800, letterSpacing:-0.5, flexShrink:0 }}>HA</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:18, fontWeight:800, color:fmb.ink, letterSpacing:-0.3 }}>Hessa Al Mansoori</div>
                <div style={{ fontSize:12, color:fmb.inkSoft, fontWeight:600, marginTop:3, display:'flex', alignItems:'center', gap:5 }}>
                  <Icons.Phone width="11" height="11"/> +971 50 234 5678
                </div>
              </div>
            </div>
          </div>

          {/* Car details — 2x2 mint grid */}
          <Eyebrow style={{ marginTop:20, marginBottom:10 }}>Vehicle</Eyebrow>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              { l:'Make',   v:'Nissan' },
              { l:'Type',   v:'Patrol SUV' },
              { l:'Colour', v:'Pearl White' },
              { l:'Plate',  v:'DXB · A 42891', mono:true },
            ].map(c => (
              <div key={c.l} style={{ background:fmb.mint, borderRadius:14, padding:'12px 14px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:fmb.primaryDeep, letterSpacing:0.4, textTransform:'uppercase' }}>{c.l}</div>
                <div style={{ fontSize:14, fontWeight:800, color:fmb.ink, letterSpacing:-0.2, marginTop:5, fontFamily: c.mono ? 'ui-monospace, monospace' : 'inherit' }}>{c.v}</div>
              </div>
            ))}
          </div>

          {/* Service block */}
          <Eyebrow style={{ marginTop:20, marginBottom:10 }}>Service · with promo</Eyebrow>
          <div style={{ background:fmb.white, border:`1.5px solid ${fmb.mintEdge}`, borderRadius:16, padding:'12px 14px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:fmb.ink, letterSpacing:-0.3 }}>Deep Clean</div>
                <div style={{ fontSize:11, color:fmb.inkSoft, fontWeight:600, marginTop:3 }}>90 min · includes interior shampoo</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:4, justifyContent:'flex-end' }}>
                  <span style={{ fontSize:10, fontWeight:700, color:fmb.inkSoft, textDecoration:'line-through' }}>AED 200</span>
                </div>
                <div style={{ display:'flex', alignItems:'baseline', gap:2 }}>
                  <span style={{ fontSize:34, fontWeight:800, color:fmb.ink, fontFamily:'"DM Sans",system-ui', letterSpacing:-1, lineHeight:1 }}>180</span>
                  <span style={{ fontSize:14, fontWeight:700, color:fmb.inkSoft, fontFamily:'"DM Sans",system-ui' }}>.00</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{
                display:'inline-flex', alignItems:'center', gap:5,
                background:fmb.sand, color:'#7A4D12',
                padding:'4px 9px', borderRadius:6,
                fontSize:11, fontWeight:800, letterSpacing:0.3, textTransform:'uppercase',
                fontFamily:'ui-monospace, monospace',
              }}>AQUA10 · −AED 20</span>
              <span style={{ fontSize:11, color:fmb.inkSoft }}>Auto-applied</span>
            </div>
          </div>

          {/* Bay assignment */}
          <Eyebrow style={{ marginTop:20, marginBottom:10 }}>Bay assignment</Eyebrow>
          <button style={{
            width:'100%', height:56, padding:'0 16px', borderRadius:14,
            border:`1.5px solid ${fmb.mintEdge}`, background:fmb.white,
            cursor:'pointer', display:'flex', alignItems:'center', gap:12,
            fontFamily:'inherit',
          }}>
            <div style={{ width:36, height:36, borderRadius:10, background:fmb.primary, color:fmb.white, display:'grid', placeItems:'center', fontSize:14, fontWeight:800, flexShrink:0 }}>3</div>
            <div style={{ flex:1, textAlign:'left' }}>
              <div style={{ fontSize:14, fontWeight:700, color:fmb.ink, letterSpacing:-0.2 }}>Bay 3 · SUV</div>
              <div style={{ fontSize:10, fontWeight:700, color:fmb.primaryDeep, letterSpacing:0.3, textTransform:'uppercase' }}>Free now</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:5, color:fmb.primaryDeep, fontSize:11, fontWeight:700 }}>
              <Icons.Swap width="14" height="14"/> Swap
            </div>
          </button>
        </div>

        {/* Action stack */}
        <div style={{
          padding:'14px 16px 28px',
          borderTop:`1px solid ${fmb.mintEdge}`,
          background:fmb.white,
          display:'flex', flexDirection:'column', gap:10,
        }}>
          <button style={{
            width:'100%', height:60, borderRadius:16,
            background:`linear-gradient(135deg,${fmb.primary},${fmb.primaryDeep})`,
            color:fmb.white, border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            fontSize:15, fontWeight:800, letterSpacing:-0.2, fontFamily:'inherit',
            boxShadow:'0 10px 24px rgba(15,118,110,0.45)',
          }}>
            <Icons.Check width="20" height="20"/>
            Check in · Send wash-ready push
          </button>
          <button style={{
            width:'100%', height:52, borderRadius:14,
            background:fmb.white, color:fmb.primaryDeep,
            border:`1.5px solid ${fmb.primary}`, cursor:'pointer',
            fontSize:14, fontWeight:700, letterSpacing:-0.1, fontFamily:'inherit',
          }}>
            Mark in-progress
          </button>
          <button style={{
            width:'100%', height:36,
            background:'transparent', color:fmb.coral,
            border:'none', cursor:'pointer',
            fontSize:12, fontWeight:700, fontFamily:'inherit',
          }}>
            Cancel · No-show
          </button>
        </div>
      </div>
    </Phone>
  );
}

Object.assign(window, {
  Screen1_BayBoard, Screen2_Bookings, Screen3_Scanner, Screen4_Walkin, Screen5_Detail,
});
