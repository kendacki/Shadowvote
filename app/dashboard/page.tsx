'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { styled } from '@/stitches.config';

const LoadWrap = styled(motion.div, {
  minHeight: '100vh',
  backgroundColor: '$white',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '$4',
  padding: '$6',
});

const LoadCaption = styled('p', {
  margin: 0,
  fontFamily: '$poppins',
  fontSize: '$sm',
  color: '$gray500',
});

const Spinner = styled(motion.div, {
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  border: '3px solid $gray200',
  borderTopColor: '$red400',
});

function DashboardLoading() {
  return (
    <LoadWrap initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <Spinner animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }} />
      <LoadCaption>Loading dashboard…</LoadCaption>
    </LoadWrap>
  );
}

/**
 * Heavy Midnight bindings load only in the browser. A visible fallback replaces `loading: () => null`,
 * which previously left a blank screen until the chunk resolved.
 */
const DashboardClient = dynamic(() => import('./DashboardClient'), {
  ssr: false,
  loading: () => <DashboardLoading />,
});

export default function DashboardPage() {
  return <DashboardClient />;
}
