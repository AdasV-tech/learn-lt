/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Tactical palette: deep olive base, high-contrast signal green.
        base: {
          50: '#f4f7f4',
          100: '#e4ebe5',
          200: '#c8d7ca',
          300: '#9db6a1',
          400: '#6c8e72',
          500: '#4b7052',
          600: '#385940',
          700: '#2d4734',
          800: '#22352a',
          900: '#16241c',
          950: '#0d1712',
        },
        signal: {
          DEFAULT: '#4ade80',
          soft: '#86efac',
          deep: '#16a34a',
          dark: '#15803d',
        },
        alert: '#f87171',
        warn: '#fbbf24',
        info: '#60a5fa',
        // The Lithuanian flag, used for accents and the level badges.
        lt: {
          yellow: '#fdb913',
          green: '#006a44',
          red: '#c1272d',
        },
      },
      fontFamily: {
        sans: [
          'InterVariable',
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px -12px rgb(0 0 0 / 0.25)',
        press: 'inset 0 -4px 0 0 rgb(0 0 0 / 0.18)',
        glow: '0 0 0 3px rgb(74 222 128 / 0.25)',
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.94)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'count-up': {
          '0%': { transform: 'translateY(6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'pop-in': 'pop-in 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-up': 'slide-up 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        shake: 'shake 380ms ease-in-out',
        'pulse-ring': 'pulse-ring 1.4s ease-out infinite',
        'count-up': 'count-up 260ms ease-out',
      },
    },
  },
  plugins: [],
};
