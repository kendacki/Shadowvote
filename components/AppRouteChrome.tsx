'use client';

import { Button } from '@/components/Button';
import { Caption } from '@/components/Typography';
import { useMidnightWallet } from '@/hooks/useMidnightWallet';
import { styled } from '@/stitches.config';
import Link from 'next/link';
import { formatTNight, truncateAddress } from '@/utils/formatters';

const Bar = styled('div', {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '$3',
  marginBottom: '$6',
  paddingBottom: '$4',
  borderBottom: '1px solid #E5E7EB',
});

const HomeLink = styled(Link, {
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$sm',
  color: '$red400',
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
});

const Meta = styled('div', {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '$3',
});

/** Light-theme wayfinding + wallet when the global marketing header is not mounted. */
export function AppRouteChrome() {
  const wallet = useMidnightWallet();
  if (!wallet.isConnected || !wallet.unshieldedAddress) return null;

  return (
    <Bar>
      <HomeLink href="/">← Home</HomeLink>
      <Meta>
        <Caption
          title={wallet.unshieldedAddress}
          css={{
            fontFamily: '$poppins',
            fontSize: '$sm',
            color: '$gray600',
            margin: 0,
          }}
        >
          {truncateAddress(wallet.unshieldedAddress)} · {formatTNight(wallet.tNightBalance)}
        </Caption>
        <Button type="button" variant="secondary" onClick={() => wallet.disconnect()}>
          Disconnect
        </Button>
      </Meta>
    </Bar>
  );
}
