// Loyalty tier chip + helpers. Rendered next to customer names on
// booking rows + on the Loyalty page. Designed to be reusable.
//
// Palette per tier:
//   Bronze   — sand/amber (neutral, default)
//   Silver   — mint-edge (subtle silver-ish)
//   Gold     — sand-deep (warm gold)
//   Platinum — primary-deep gradient (premium look)

import type { LoyaltyTier } from '../api/loyalty';

const META: Record<LoyaltyTier, { label: string; classes: string; style?: React.CSSProperties }> = {
  bronze: {
    label: 'Bronze',
    classes: 'bg-sand text-[#7a4d12]',
  },
  silver: {
    label: 'Silver',
    classes: 'bg-mint-edge text-ink',
  },
  gold: {
    label: 'Gold',
    classes: 'text-[#5a3a08] font-bold',
    style: { backgroundImage: 'linear-gradient(135deg, #F5C77E, #FBF1DF)' },
  },
  platinum: {
    label: 'Platinum',
    classes: 'text-white font-bold',
    style: { backgroundImage: 'linear-gradient(135deg, #14B8A6, #0F766E)' },
  },
};

export function TierBadge({
  tier,
  size = 'md',
}: {
  tier: LoyaltyTier;
  size?: 'sm' | 'md';
}) {
  const m = META[tier];
  const dims =
    size === 'sm'
      ? 'px-2 py-0.5 text-[9px]'
      : 'px-2.5 py-1 text-[10px]';
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider ${dims} ${m.classes}`}
      style={m.style}
    >
      {m.label}
    </span>
  );
}

export function tierLabel(tier: LoyaltyTier): string {
  return META[tier].label;
}

// Used as a quick descriptor next to the badge — "8th visit",
// "1st visit", "1st here, 12 platform-wide". Keeps the badge a
// pure tier marker; the contextual detail goes here.
export function visitCounter(opts: {
  lifetimeBookings: number;
  bookingsAtVendor?: number;
}): string {
  const { lifetimeBookings, bookingsAtVendor } = opts;
  if (bookingsAtVendor === undefined) {
    return ordinal(lifetimeBookings + 1) + ' visit';
  }
  if (bookingsAtVendor === 0) {
    return lifetimeBookings === 0 ? 'First wash' : `New here · ${lifetimeBookings} platform-wide`;
  }
  return `${ordinal(bookingsAtVendor + 1)} visit here`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
