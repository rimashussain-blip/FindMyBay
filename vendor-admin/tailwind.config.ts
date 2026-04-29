import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Find My Bay brand palette — same tokens as Android app.
        primary: '#14B8A6',
        'primary-deep': '#0F766E',
        ink: '#0B3B36',
        'ink-soft': '#3F6B65',
        cream: '#FFF7EC',
        sand: '#FCE7C8',
        'sand-deep': '#F5C77E',
        mint: '#E6F7F4',
        'mint-edge': '#CDEEE8',
        coral: '#FF8B6B',
        'coral-soft': '#FFE3D9',
      },
      fontFamily: {
        // Apple-system first (iOS/macOS Safari → SF Pro), with sensible
        // fallbacks for other platforms. Matches the handoff which was
        // typeset in SF Pro.
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'SF Pro Display',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
