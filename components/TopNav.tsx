'use client';

import { Button } from '@/components/Button';
import { useMidnightWallet } from '@/hooks/useMidnightWallet';
import { styled } from '@/stitches.config';
import { formatTNight, truncateAddress } from '@/utils/formatters';
import Link from 'next/link';

const EMBLEM_SRC = '/shadowvote-emblem.svg';

const Bar = styled('header', {
  position: 'sticky',
  top: 0,
  width: '100%',
  flexShrink: 0,
  zIndex: 20,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '$4',
  paddingLeft: 'max(1.25rem, env(safe-area-inset-left, 0px))',
  paddingRight: 'max(1.25rem, env(safe-area-inset-right, 0px))',
  paddingTop: '14px',
  paddingBottom: '14px',
  backgroundColor: '#FFFFFF',
  borderBottom: '1px solid #E5E7EB',
  boxSizing: 'border-box',
});

const LeftCol = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  minWidth: 0,
});

const Brand = styled(Link, {
  display: 'flex',
  alignItems: 'center',
  gap: '$3',
  textDecoration: 'none',
  color: 'inherit',
  minWidth: 0,
});

const LogoSquircle = styled('span', {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '48px',
  height: '48px',
  borderRadius: '14px',
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  flexShrink: 0,
  overflow: 'hidden',
  boxSizing: 'border-box',
});

const LogoImg = styled('img', {
  width: '36px',
  height: '36px',
  objectFit: 'contain',
  display: 'block',
});

const BrandWordmark = styled('span', {
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$lg',
  letterSpacing: '-0.03em',
  color: '$black',
  whiteSpace: 'nowrap',
});

const HomeLink = styled(Link, {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '$2',
  marginTop: '$3',
  marginLeft: '2px',
  fontFamily: '$poppins',
  fontSize: '$sm',
  fontWeight: '$semibold',
  color: '$gray600',
  textDecoration: 'none',
  transition: 'color 0.15s ease',
  '&:hover': {
    color: '$black',
  },
});

const HomeIcon = styled('svg', {
  flexShrink: 0,
  opacity: 0.85,
});

const Right = styled('div', {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '$3',
  minWidth: 0,
  flex: '1 1 auto',
  paddingTop: '4px',
});

/** Flex + minWidth 0 so ellipsis works; never lets long bech32 blow out the bar. */
const WalletCluster = styled('div', {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '$3',
  minWidth: 0,
  maxWidth: 'min(100%, 280px)',
  '@sm': { maxWidth: 'min(100%, 400px)' },
});

const WalletLine = styled('span', {
  display: 'block',
  fontFamily: '$poppins',
  fontSize: '$sm',
  fontWeight: '$regular',
  color: '$gray600',
  minWidth: 0,
  flex: '1 1 auto',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'right' as const,
});

const DisconnectBtn = styled('button', {
  all: 'unset',
  fontFamily: '$poppins',
  fontSize: '$xs',
  fontWeight: '$semibold',
  color: '$gray500',
  cursor: 'pointer',
  textDecoration: 'underline',
  flexShrink: 0,
  '&:hover': { color: '$gray600' },
});

function HouseGlyph({ className }: { className?: string }) {
  return (
    <HomeIcon
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M3 10.5L12 4l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </HomeIcon>
  );
}

export function TopNav() {
  const wallet = useMidnightWallet();

  const balanceStr = formatTNight(wallet.tNightBalance);
  const addrStr = truncateAddress(wallet.unshieldedAddress, { head: 8, tail: 6 });
  const walletSummary =
    wallet.isConnected && wallet.unshieldedAddress ? `${balanceStr} · ${addrStr}` : null;

  return (
    <Bar>
      <LeftCol>
        <Brand href="/" aria-label="ShadowVote home">
          <LogoSquircle>
            <LogoImg src={EMBLEM_SRC} alt="" width={36} height={36} decoding="async" />
          </LogoSquircle>
          <BrandWordmark>ShadowVote</BrandWordmark>
        </Brand>

        {wallet.isConnected && wallet.unshieldedAddress ? (
          <HomeLink href="/">
            <HouseGlyph />
            Homepage
          </HomeLink>
        ) : null}
      </LeftCol>

      <Right>
        {wallet.isLoading ? (
          <WalletCluster>
            <WalletLine>…</WalletLine>
          </WalletCluster>
        ) : wallet.isConnected && wallet.unshieldedAddress ? (
          <WalletCluster>
            <WalletLine title={wallet.unshieldedAddress}>{walletSummary}</WalletLine>
            <DisconnectBtn type="button" onClick={() => wallet.disconnect()}>
              Disconnect
            </DisconnectBtn>
          </WalletCluster>
        ) : (
          <Button type="button" variant="primary" disabled={wallet.isConnecting} onClick={() => void wallet.connect()}>
            {wallet.isConnecting ? 'Connecting…' : 'Connect wallet'}
          </Button>
        )}
      </Right>
    </Bar>
  );
}
