'use client';

import { getMidnightNetworkDisplayName, isMidnightMainnet, midnightNetworkEnv } from '@/config/network';
import { styled } from '@/stitches.config';
import { motion } from 'framer-motion';

const Bar = styled(motion.div, {
  width: '100%',
  flexShrink: 0,
  padding: '$2 max($4, env(safe-area-inset-left, 0px)) $2 max($4, env(safe-area-inset-right, 0px))',
  textAlign: 'center',
  fontFamily: '$poppins',
  fontSize: '$sm',
  fontWeight: '$semibold',
  color: '#422006',
  background: 'linear-gradient(90deg, #FEF3C7 0%, #FDE68A 40%, #FCD34D 100%)',
  borderBottom: '1px solid rgba(180, 83, 9, 0.25)',
  boxShadow: '0 2px 12px rgba(180, 83, 9, 0.12)',
  zIndex: 1000,
  position: 'relative',
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
      initial={{ y: -56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.85 }}
    >
      Warning: ShadowVote is running on the Midnight {name} network (not mainnet).
    </Bar>
  );
}
