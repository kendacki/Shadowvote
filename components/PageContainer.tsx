'use client';

import { styled } from '@/stitches.config';

/** Matches dashboard: `40px 20px`, max 1200px, document flow only. */
export const PageContainer = styled('div', {
  width: '100%',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '40px 20px',
  paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
  paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
  paddingBottom: 'max(40px, $9)',
  boxSizing: 'border-box',
});
