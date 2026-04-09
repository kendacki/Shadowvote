'use client';

import { keyframes, styled } from '@/stitches.config';
import { motion } from 'framer-motion';
import { useState } from 'react';

/** Opacity-only pulse so it never fights Framer Motion transforms on the same node. */
const pulseOpacity = keyframes({
  '0%, 100%': { opacity: 0.82 },
  '50%': { opacity: 1 },
});

const Root = styled('div', {
  position: 'fixed',
  inset: 0,
  /** Above page content and mobile nav; below NetworkBanner (1000) so the testnet bar stays visible. */
  zIndex: 900,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const LogoFrame = styled(motion.div, {
  display: 'flex',
  pointerEvents: 'none',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '$5',
});

/** Pulsing wrapper — keeps CSS animation off the &lt;img&gt; so layout and onError stay reliable. */
const LogoPulseWrap = styled('div', {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: `${pulseOpacity} 2.4s ease-in-out infinite`,
});

const LogoImg = styled('img', {
  width: '140px',
  height: '140px',
  objectFit: 'contain',
  display: 'block',
  filter: 'drop-shadow(0 12px 28px rgba(239, 68, 68, 0.22))',
});

const Label = styled('span', {
  fontFamily: '$poppins',
  fontWeight: '$regular',
  fontSize: '$sm',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
});

/** Branded loader art (hooded emblem PNG); falls back to vector emblem if missing. */
const LOADER_PNG = '/shadowvote-loader.png';
const FALLBACK_SVG = '/shadowvote-emblem.svg';

export type LoadingScreenProps = {
  message?: string;
  /** `light` matches dashboard shell; `dark` matches the marketing page. */
  variant?: 'dark' | 'light';
};

export function LoadingScreen({ message = 'Initializing', variant = 'dark' }: LoadingScreenProps) {
  const [src, setSrc] = useState(LOADER_PNG);

  const isLight = variant === 'light';

  return (
    <Root
      css={{
        backgroundColor: isLight ? '$white' : '#030306',
      }}
    >
      <LogoFrame
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <LogoPulseWrap>
          <LogoImg
            src={src}
            alt="ShadowVote"
            width={140}
            height={140}
            decoding="sync"
            fetchPriority="high"
            onError={() => {
              if (src !== FALLBACK_SVG) setSrc(FALLBACK_SVG);
            }}
          />
        </LogoPulseWrap>
        <Label
          css={{
            color: isLight ? '$gray500' : '#A1A1AA',
          }}
        >
          {message}
        </Label>
      </LogoFrame>
    </Root>
  );
}
