import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Find My Bay brand palette — same tokens as Android app.
        primary: '#14B8A6',
        'primary-deep': '#0F766E',
        'primary-darker': '#0B3B36',
        ink: '#0B3B36',
        'ink-soft': '#5C7A75',
        cream: '#FFF7EC',
        'cream-2': '#FBF1DF',
        sand: '#FCE7C8',
        'sand-deep': '#F5C77E',
        amber: '#F5C77E',
        mint: '#E6F7F4',
        'mint-2': '#DBF5F0',
        'mint-edge': '#CDEEE8',
        coral: '#FF8B6B',
        'coral-soft': '#FFE3D9',
      },
      fontFamily: {
        // Plus Jakarta Sans matches the design handoff. Loaded via Google
        // Fonts in index.html. Apple system fallbacks keep things working
        // when the font hasn't finished loading.
        sans: [
          '"Plus Jakarta Sans"',
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
