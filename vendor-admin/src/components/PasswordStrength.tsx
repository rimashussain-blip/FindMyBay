// Lightweight password-strength meter — visual feedback only, the
// backend still enforces its own minimums (currently length ≥ 8).
//
// Scoring is deliberately simple: 0–4 buckets driven by length + character
// class diversity. No zxcvbn dependency (it's 700KB gzipped); for a wash
// app's vendor portal a heuristic meter is sufficient.

export interface PasswordScore {
  /** 0 = empty, 1 = weak, 2 = fair, 3 = good, 4 = strong */
  level: 0 | 1 | 2 | 3 | 4;
  /** Human-readable label for the bar. */
  label: string;
  /** Soft hint shown under the bar — empty when password is strong. */
  hint: string;
}

export function scorePassword(pwd: string): PasswordScore {
  if (!pwd) return { level: 0, label: '', hint: '' };

  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  // Character-class diversity: lowercase, uppercase, digits, symbols.
  const classes =
    Number(/[a-z]/.test(pwd)) +
    Number(/[A-Z]/.test(pwd)) +
    Number(/\d/.test(pwd)) +
    Number(/[^A-Za-z0-9]/.test(pwd));
  if (classes >= 3) score++;
  if (classes === 4 && pwd.length >= 12) score++;

  // Common-password tail penalty — catches the obvious "Password1!" footgun.
  if (/(password|qwerty|12345)/i.test(pwd)) score = Math.max(0, score - 1);

  const level = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  const labels = ['', 'Too weak', 'Fair', 'Good', 'Strong'] as const;
  const hints = [
    '',
    'Add more characters and mix upper/lower case + digits.',
    "Looking better — try a longer password or add a symbol.",
    'Solid. A longer password would push it to "strong".',
    '',
  ] as const;

  return { level, label: labels[level], hint: hints[level] };
}

export function PasswordStrengthBar({ password }: { password: string }) {
  const { level, label, hint } = scorePassword(password);
  if (!password) return null;

  const palette = [
    'bg-mint-edge',
    'bg-coral',
    'bg-amber',
    'bg-primary',
    'bg-primary-deep',
  ] as const;
  const textPalette = [
    'text-ink-soft',
    'text-coral',
    'text-[#7a4d12]',
    'text-primary-deep',
    'text-primary-deep',
  ] as const;

  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={[
              'h-1 flex-1 rounded-full transition-colors',
              level >= i ? palette[level] : 'bg-mint-edge',
            ].join(' ')}
          />
        ))}
        <span className={`ml-2 text-[10px] font-bold uppercase tracking-wider ${textPalette[level]}`}>
          {label}
        </span>
      </div>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}
