'use client';

import { styled } from '@/stitches.config';

export const H1 = styled('h1', {
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: 'clamp($2xl, 4vw, $3xl)',
  lineHeight: 1.15,
  letterSpacing: '-0.02em',
  color: '$black',
  margin: 0,
});

export const H2 = styled('h2', {
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$xl',
  lineHeight: 1.3,
  color: '$black',
  margin: 0,
});

export const Body = styled('p', {
  fontFamily: '$poppins',
  fontWeight: '$regular',
  fontSize: '$lg',
  lineHeight: 1.65,
  color: '$gray600',
  margin: 0,
});

export const Caption = styled('span', {
  fontFamily: '$poppins',
  fontWeight: '$regular',
  fontSize: '$sm',
  lineHeight: 1.5,
  color: '$gray500',
});

export const FeatureTitle = styled('h3', {
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$md',
  color: '$black',
  margin: '0 0 $2 0',
});

export const FeatureBody = styled('p', {
  fontFamily: '$poppins',
  fontWeight: '$regular',
  fontSize: '$sm',
  lineHeight: 1.6,
  color: '$gray600',
  margin: 0,
});
