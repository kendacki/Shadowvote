'use client';

import { styled } from '@/stitches.config';

/** Max-width column with dashboard/detail spacing below global shell offset. */
export const PageContainer = styled('div', {
  width: '100%',
  maxWidth: '1200px',
  margin: '0 auto',
  paddingTop: '40px',
  paddingLeft: 'max($5, env(safe-area-inset-left, 0px))',
  paddingRight: 'max($5, env(safe-area-inset-right, 0px))',
  paddingBottom: '$9',
  '@md': {
    paddingLeft: 'max($8, env(safe-area-inset-left, 0px))',
    paddingRight: 'max($8, env(safe-area-inset-right, 0px))',
  },
});
