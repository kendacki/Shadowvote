'use client';

import { Button } from '@/components/Button';
import { Body, Caption } from '@/components/Typography';
import { useMidnightWallet } from '@/hooks/useMidnightWallet';
import { styled } from '@/stitches.config';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { formatTNight, truncateAddress } from '@/utils/formatters';

const Bar = styled(motion.nav, {
  position: 'sticky',
  top: 0,
  zIndex: 920,
  height: '72px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '$4',
  paddingLeft: 'max($5, env(safe-area-inset-left, 0px))',
  paddingRight: 'max($5, env(safe-area-inset-right, 0px))',
  backgroundColor: '#FFFFFF',
  borderBottom: '1px solid #E5E7EB',
  boxShadow: '0 1px 0 rgba(0, 0, 0, 0.04)',
  '@md': {
    paddingLeft: 'max($8, env(safe-area-inset-left, 0px))',
    paddingRight: 'max($8, env(safe-area-inset-right, 0px))',
  },
});

const Brand = styled(Link, {
  display: 'flex',
  alignItems: 'center',
  gap: '$3',
  textDecoration: 'none',
  color: 'inherit',
  flexShrink: 0,
});

const LogoMark = styled('span', {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  borderRadius: '$md',
  border: '1px solid #E5E7EB',
  overflow: 'hidden',
  backgroundColor: '$white',
});

const BrandText = styled('span', {
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$lg',
  color: '$black',
  letterSpacing: '-0.02em',
});

const Right = styled('div', {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '$3',
});

const WalletMeta = styled('div', {
  display: 'none',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '$1',
  '@sm': {
    display: 'flex',
  },
});

const GhostLink = styled('button', {
  all: 'unset',
  fontFamily: '$poppins',
  fontSize: '$xs',
  fontWeight: '$semibold',
  color: '$gray500',
  cursor: 'pointer',
  textDecoration: 'underline',
  '&:hover': { color: '$gray600' },
});

export function TopNav() {
  const wallet = useMidnightWallet();

  return (
    <Bar initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Brand href="/">
        <LogoMark>
          <img src="/shadowvote-emblem.svg" alt="" width={40} height={40} style={{ objectFit: 'contain' }} />
        </LogoMark>
        <BrandText>ShadowVote</BrandText>
      </Brand>

      <Right>
        {wallet.isLoading ? (
          <Caption css={{ color: '$gray500', fontFamily: '$poppins' }}>Wallet…</Caption>
        ) : wallet.isConnected && wallet.unshieldedAddress ? (
          <>
            <WalletMeta>
              <Body
                title={wallet.unshieldedAddress}
                css={{
                  margin: 0,
                  fontSize: '$sm',
                  fontWeight: '$semibold',
                  fontFamily: '$poppins',
                  fontVariantNumeric: 'tabular-nums',
                  color: '$black',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {truncateAddress(wallet.unshieldedAddress)}
              </Body>
              <Caption css={{ fontFamily: '$poppins' }}>{formatTNight(wallet.tNightBalance)}</Caption>
            </WalletMeta>
            <GhostLink type="button" onClick={() => wallet.disconnect()}>
              Disconnect
            </GhostLink>
          </>
        ) : (
          <Button type="button" variant="primary" disabled={wallet.isConnecting} onClick={() => void wallet.connect()}>
            {wallet.isConnecting ? 'Connecting…' : 'Connect wallet'}
          </Button>
        )}
      </Right>
    </Bar>
  );
}
