import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

const config: Config = {
  // Class-based dark mode (controlled by <html class="dark">)
  darkMode: ['class'],

  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  theme: {
    extend: {
      // ─── Inkquire Colour Palette ────────────────────────────────────────────
      colors: {
        // Core dark palette — the canvas of every Inkquire surface
        ink: {
          50:  '#f2f2f2',
          100: '#e6e6e6',
          200: '#cccccc',
          300: '#b3b3b3',
          400: '#808080',
          500: '#666666',
          600: '#4d4d4d',
          700: '#333333',
          800: '#1a1a1a',
          900: '#0f0f0f',
          950: '#080808',
        },

        // Aged paper — primary text and light surfaces
        parchment: {
          50:  '#faf8f3',
          100: '#f5f1e8',
          200: '#ebe3d0',
          300: '#d9ccb0',
          400: '#c4b08a',
          500: '#a8906a',
        },

        // Gold accent — calls to action, highlights, premium signals
        gold: {
          200: '#ffe599',
          300: '#ffd97d',
          400: '#ffc94d',
          500: '#ffb700',
          600: '#cc9200',
          700: '#a37500',
          800: '#7a5800',
        },

        // Crimson accent — danger, cancellation, bold emphasis
        crimson: {
          400: '#e03a5a',
          500: '#c41e3a',
          600: '#9e1830',
          700: '#7a1226',
        },

        // ─── Semantic CSS-variable-backed tokens (shadcn/ui compatible) ───────
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',

        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input:  'hsl(var(--input))',
        ring:   'hsl(var(--ring))',
      },

      // ─── Typography ────────────────────────────────────────────────────────
      fontFamily: {
        // Injected at runtime via CSS variables in app/layout.tsx
        sans:    ['var(--font-sans)',    ...defaultTheme.fontFamily.sans],
        display: ['var(--font-display)', ...defaultTheme.fontFamily.serif],
        mono:    ['var(--font-mono)',    ...defaultTheme.fontFamily.mono],
      },

      fontSize: {
        '2xs': ['0.65rem',  { lineHeight: '1rem' }],
        xs:    ['0.75rem',  { lineHeight: '1rem' }],
        sm:    ['0.875rem', { lineHeight: '1.25rem' }],
        base:  ['1rem',     { lineHeight: '1.5rem' }],
        lg:    ['1.125rem', { lineHeight: '1.75rem' }],
        xl:    ['1.25rem',  { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem',   { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem',  { lineHeight: '2.5rem' }],
        '5xl': ['3rem',     { lineHeight: '1.1' }],
        '6xl': ['3.75rem',  { lineHeight: '1.05' }],
        '7xl': ['4.5rem',   { lineHeight: '1' }],
        '8xl': ['6rem',     { lineHeight: '1' }],
        '9xl': ['8rem',     { lineHeight: '1' }],
      },

      // ─── Border Radius ─────────────────────────────────────────────────────
      borderRadius: {
        lg:   'var(--radius)',
        md:   'calc(var(--radius) - 2px)',
        sm:   'calc(var(--radius) - 4px)',
        none: '0',
      },

      // ─── Shadows ───────────────────────────────────────────────────────────
      boxShadow: {
        'gold':        '0 0 20px rgba(255, 183, 0, 0.15)',
        'gold-lg':     '0 0 40px rgba(255, 183, 0, 0.25)',
        'gold-border': '0 0 0 1px rgba(255, 183, 0, 0.4)',
        'card':        '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover':  '0 4px 12px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.4)',
        'inset-top':   'inset 0 1px 0 rgba(255,255,255,0.05)',
      },

      // ─── Background Gradients ──────────────────────────────────────────────
      backgroundImage: {
        'gradient-radial':  'radial-gradient(var(--tw-gradient-stops))',
        'gradient-ink':     'linear-gradient(to bottom, #0f0f0f, #080808)',
        'gradient-surface': 'linear-gradient(to bottom, #1a1a1a, #0f0f0f)',
        'gradient-gold':    'linear-gradient(135deg, #ffb700, #ffd97d)',
        // Subtle noise texture for depth on solid dark surfaces
        'noise': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
      },

      // ─── Animations ────────────────────────────────────────────────────────
      animation: {
        'fade-in':      'fade-in 0.25s ease-in-out',
        'fade-up':      'fade-up 0.35s ease-out',
        'fade-down':    'fade-down 0.35s ease-out',
        'slide-in-r':   'slide-in-r 0.3s ease-out',
        'scale-in':     'scale-in 0.2s ease-out',
        'pulse-gold':   'pulse-gold 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'shimmer':      'shimmer 1.5s infinite',
        'spin-slow':    'spin 3s linear infinite',
      },

      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-down': {
          '0%':   { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-r': {
          '0%':   { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-gold': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },

      // ─── Spacing Overrides ─────────────────────────────────────────────────
      spacing: {
        '18':  '4.5rem',
        '22':  '5.5rem',
        '30':  '7.5rem',
        '34':  '8.5rem',
        '88':  '22rem',
        '100': '25rem',
        '112': '28rem',
        '128': '32rem',
      },
    },
  },

  plugins: [],
}

export default config
