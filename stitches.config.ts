import { createStitches } from '@stitches/react';

export const {
  styled,
  css,
  keyframes,
  theme,
  getCssText,
  globalCss,
  config,
} = createStitches({
  theme: {
    colors: {
      white: '#FFFFFF',
      black: '#0A0A0A',
      gray50: '#FAFAFA',
      gray100: '#F4F4F5',
      gray200: '#E4E4E7',
      gray400: '#A1A1AA',
      gray500: '#71717A',
      gray600: '#52525B',
      red400: '#EF4444',
      red700: '#B91C1C',
    },
    space: {
      1: '4px',
      2: '8px',
      3: '12px',
      4: '16px',
      5: '24px',
      6: '32px',
      7: '48px',
      8: '64px',
      9: '96px',
    },
    radii: {
      sm: '8px',
      md: '12px',
      lg: '16px',
      pill: '9999px',
    },
    fontSizes: {
      xs: '0.8125rem',
      sm: '0.9375rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.5rem',
      '2xl': '2.25rem',
      '3xl': '3rem',
    },
    fonts: {
      /** Prefer next/font via `--font-poppins` on `<html>`, fallback to stack */
      poppins: 'var(--font-poppins), "Poppins", system-ui, sans-serif',
    },
    fontWeights: {
      regular: 400,
      semibold: 600,
    },
    shadows: {
      buttonPrimary: '0 8px 24px rgba(185, 28, 28, 0.25)',
      soft: '0 4px 24px rgba(15, 23, 42, 0.06)',
    },
  },
  media: {
    xs: '(min-width: 480px)',
    sm: '(min-width: 640px)',
    md: '(min-width: 768px)',
    lg: '(min-width: 1024px)',
  },
});

/** Primary brand gradient — red-400 → red-700 */
export const gradientPrimary = 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)';

export const globalStyles = globalCss({
  '*, *::before, *::after': { boxSizing: 'border-box' },
  body: {
    margin: 0,
    backgroundColor: '$white',
    color: '$gray600',
    fontFamily: '$poppins',
    fontWeight: '$regular',
    WebkitFontSmoothing: 'antialiased',
  },
});
