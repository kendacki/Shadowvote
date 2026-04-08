'use client';

import { keyframes, styled } from '@/stitches.config';
import { motion } from 'framer-motion';
import { useState } from 'react';

const pulse = keyframes({
  '0%, 100%': { opacity: 0.85, transform: 'scale(1)' },
  '50%': { opacity: 1, transform: 'scale(1.02)' },
});

const Root = styled('div', {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#030306',
});

const LogoFrame = styled(motion.div, {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '$5',
});

const Logo = styled(motion.img, {
  width: '120px',
  height: '120px',
  objectFit: 'contain',
  filter: 'drop-shadow(0 12px 32px rgba(239, 68, 68, 0.2))',
  animation: `${pulse} 2.4s ease-in-out infinite`,
});

const Label = styled('span', {
  fontFamily: '$poppins',
  fontWeight: '$regular',
  fontSize: '$sm',
  color: '#A1A1AA',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
});

const LOGO_PNG = '/shadowvote-logo.png';
const LOGO_SVG = '/shadowvote-emblem.svg';

type LoadingScreenProps = {
  message?: string;
};

export function LoadingScreen({ message = 'Initializing' }: LoadingScreenProps) {
  const [src, setSrc] = useState(LOGO_PNG);
  return (
    <Root>
      <LogoFrame
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <Logo
          src={src}
          alt="ShadowVote"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
          onError={() => {
            if (src !== LOGO_SVG) setSrc(LOGO_SVG);
          }}
        />
        <Label>{message}</Label>
      </LogoFrame>
    </Root>
  );
}
