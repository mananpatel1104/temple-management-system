import type { Config } from 'tailwindcss';

/**
 * Tailwind is configured mobile-first by default (unprefixed = smallest
 * screen; sm:/md:/lg: scale up), matching SRS 24.18 Responsive Design and
 * DP-007 (usable on older Android devices).
 *
 * Color tokens follow SRS 24.3 Design Theme. Actual shade values are
 * intentionally left as CSS custom properties (see src/styles/themes/) so
 * Light/Dark/System theming (SRS 24.2) can swap values without touching
 * this config — no feature/UI implementation lives here.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      xs: '375px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        saffron: 'rgb(var(--color-saffron) / <alpha-value>)',
        golden: 'rgb(var(--color-golden) / <alpha-value>)',
        cream: 'rgb(var(--color-cream) / <alpha-value>)',
        'surface-light': 'rgb(var(--color-surface-light) / <alpha-value>)',
        'surface-dark': 'rgb(var(--color-surface-dark) / <alpha-value>)',
        'sky-info': 'rgb(var(--color-sky-info) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
      },
      fontFamily: {
        en: ['Inter', 'system-ui', 'sans-serif'],
        gu: ['"Noto Sans Gujarati"', 'system-ui', 'sans-serif'],
        hi: ['"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Mirrors SRS 24.4 adjustable font-size levels (Small/Normal/Large/XL)
        'app-sm': ['0.875rem', { lineHeight: '1.4' }],
        'app-base': ['1rem', { lineHeight: '1.5' }],
        'app-lg': ['1.125rem', { lineHeight: '1.6' }],
        'app-xl': ['1.25rem', { lineHeight: '1.7' }],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      borderRadius: {
        card: '1rem',
      },
    },
  },
  plugins: [],
};

export default config;
