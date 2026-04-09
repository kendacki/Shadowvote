'use client';

import { Button } from '@/components/Button';
import { useMidnightWallet } from '@/hooks/useMidnightWallet';
import { styled } from '@/stitches.config';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

const LOGO_PREFERRED = '/shadowvote-logo.png';
const LOGO_FALLBACK = '/shadowvote-emblem.svg';

const Bar = styled('header', {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '80px',
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '$4',
  paddingLeft: 'max(1.5rem, env(safe-area-inset-left, 0px))',
  paddingRight: 'max(1.5rem, env(safe-area-inset-right, 0px))',
  backgroundColor: '#FFFFFF',
  borderBottom: '1px solid #E5E7EB',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  boxSizing: 'border-box',
});

const Brand = styled(Link, {
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  textDecoration: 'none',
  minWidth: 0,
});

const Right = styled('div', {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '$3',
  minWidth: 0,
});

const WalletLine = styled('span', {
  fontFamily: '$poppins',
  fontSize: '$sm',
  fontWeight: '$regular',
  color: '$gray600',
  maxWidth: 'min(340px, 72vw)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  '@sm': { maxWidth: '420px' },
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

/** Compact preview (e.g. `d07a...5e26`) — never shows the full raw string when long. */
function truncateForNav(address: string | null | undefined): string {
  if (address == null) return '—';
  const t = address.trim();
  if (t === '') return '—';
  const head = 4;
  const tail = 4;
  if (t.length <= head + tail + 3) return t;
  return `${t.slice(0, head)}...${t.slice(-tail)}`;
}

function formatCompactTNight(amount: bigint | null | undefined): string {
  if (amount == null) return '—';
  const whole = amount / 1_000_000n;
  return `${whole.toString()} tNight`;
}

export function TopNav() {
  const wallet = useMidnightWallet();
  const [logoSrc, setLogoSrc] = useState(LOGO_PREFERRED);

  const balanceStr = formatCompactTNight(wallet.tNightBalance);
  const addrStr = truncateForNav(wallet.unshieldedAddress);
  const walletSummary =
    wallet.isConnected && wallet.unshieldedAddress ? `${balanceStr} | ${addrStr}` : null;

  return (
    <Bar>
      <Brand href="/" aria-label="ShadowVote home">
        <Image
          src={logoSrc}
          alt="ShadowVote"
          width={150}
          height={40}
          priority
          style={{ height: 40, width: 'auto', maxWidth: 150, objectFit: 'contain' }}
          onError={() => {
            if (logoSrc !== LOGO_FALLBACK) setLogoSrc(LOGO_FALLBACK);
          }}
        />
      </Brand>

      <Right>
        {wallet.isLoading ? (
          <WalletLine>…</WalletLine>
        ) : wallet.isConnected && wallet.unshieldedAddress ? (
          <>
            <WalletLine>{walletSummary}</WalletLine>
            <DisconnectBtn type="button" onClick={() => wallet.disconnect()}>
              Disconnect
            </DisconnectBtn>
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
