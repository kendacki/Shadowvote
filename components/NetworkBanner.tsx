'use client';

import { getMidnightNetworkDisplayName, isMidnightMainnet, midnightNetworkEnv } from '@/config/network';
import { styled } from '@/stitches.config';
import { motion } from 'framer-motion';

const Bar = styled(motion.div, {
  position: 'relative',
  width: '100%',
  zIndex: 60,
  flexShrink: 0,
  padding: '$2 max($4, env(safe-area-inset-left, 0px)) $2 max($4, env(safe-area-inset-right, 0px))',
  textAlign: 'center',
  fontFamily: '$poppins',
  fontSize: '$sm',
  fontWeight: '$semibold',
  color: '#7C2D12',
  background: 'linear-gradient(90deg, #FFFBEB 0%, #FDE68A 35%, #FBBF24 100%)',
  borderBottom: '1px solid rgba(180, 83, 9, 0.35)',
  boxSizing: 'border-box',
});

/**
 * Full-width non-mainnet warning for production deployments (Vercel, etc.).
 */
export function NetworkBanner() {
  if (isMidnightMainnet(midnightNetworkEnv)) {
    return null;
  }

  const name = getMidnightNetworkDisplayName(midnightNetworkEnv);

  return (
    <Bar
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      Warning: ShadowVote is running on the Midnight {name} network (not mainnet).
    </Bar>
  );
}
