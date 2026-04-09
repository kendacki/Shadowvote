'use client';

import { Body, H2 } from '@/components/Typography';
import { styled } from '@/stitches.config';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const Root = styled(motion.div, {
  maxWidth: '520px',
  margin: '0 auto',
  padding: '$8 $5',
  borderRadius: '$lg',
  border: '1px dashed $gray200',
  backgroundColor: '$gray50',
  textAlign: 'center',
});

export type EmptyStateProps = {
  title: string;
  description: ReactNode;
  children?: ReactNode;
};

/** Centered empty / onboarding panel for list dashboards. */
export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <Root
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <H2 css={{ marginTop: 0, marginBottom: '$3', fontSize: '$xl', color: '$black' }}>{title}</H2>
      <Body css={{ color: '$gray500', marginBottom: children ? '$5' : 0 }}>{description}</Body>
      {children}
    </Root>
  );
}
