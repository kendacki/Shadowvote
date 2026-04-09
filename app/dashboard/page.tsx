"use client";

import { EmptyState } from '@/components/EmptyState';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Body, Caption, H1 } from '@/components/Typography';
import { Button } from '@/components/Button';
import { useMidnightWallet } from '@/hooks/useMidnightWallet';
import { useShadowVote } from '@/hooks/useShadowVote';
import { useVoterIdentity } from '@/hooks/useVoterIdentity';
import { styled } from '@/stitches.config';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { formatTNight, truncateAddress } from '@/utils/formatters';

const PageShell = styled(motion.div, {
  minHeight: '100vh',
  backgroundColor: '$white',
});

const Header = styled('header', {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '$4',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '$6 max($5, env(safe-area-inset-left, 0px)) $6 max($5, env(safe-area-inset-right, 0px))',
  '@md': { padding: '$6 max($8, env(safe-area-inset-left, 0px)) $6 max($8, env(safe-area-inset-right, 0px))' },
});

const WalletPanel = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '$1',
  textAlign: 'left',
  width: '100%',
  '@sm': {
    width: 'auto',
    alignItems: 'flex-end',
    textAlign: 'right',
  },
});

const DisconnectPrompt = styled(motion.div, {
  maxWidth: '520px',
  margin: '0 auto',
  padding: '$8 $5',
  textAlign: 'center',
});

export default function DashboardPage() {
  const router = useRouter();
  const wallet = useMidnightWallet();
  const api = wallet?.getConnectedApi?.() ?? null;
  const identity = useVoterIdentity();
  const shadowVote = useShadowVote(api, identity?.voterSecret ?? null);

  const proposals = shadowVote?.proposals;
  const isLoading = shadowVote?.isLoadingProposals ?? false;

  useEffect(() => {
    console.log({ isLoading, proposalsLength: proposals?.length, proposals });
  }, [isLoading, proposals]);

  if (wallet?.isLoading) {
    return <LoadingScreen message="Loading wallet…" variant="light" />;
  }

  if (!wallet?.isConnected || !wallet?.unshieldedAddress) {
    return (
      <PageShell initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <DisconnectPrompt initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <H1 css={{ marginBottom: '$4' }}>Connect your wallet</H1>
          <Body css={{ marginBottom: '$6' }}>
            The ShadowVote dashboard needs an active Lace connection to read contract state and submit shielded
            votes. Head back to the home page and connect to Preprod.
          </Body>
          <Button type="button" variant="primary" onClick={() => router.push('/')}>
            Return home
          </Button>
        </DisconnectPrompt>
      </PageShell>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <Header>
        <div>
          <Caption>ShadowVote</Caption>
          <H1 css={{ margin: 0, fontSize: '$xl', fontWeight: '$semibold', color: '$black' }}>
            Governance Dashboard
          </H1>
        </div>
        <WalletPanel>
          <Caption>Wallet</Caption>
          <Body
            title={wallet.unshieldedAddress}
            css={{
              fontSize: '$sm',
              color: '$black',
              fontWeight: '$semibold',
              fontFamily: 'ui-monospace, "Cascadia Mono", monospace',
              maxWidth: 'min(260px, 72vw)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {truncateAddress(wallet.unshieldedAddress)}
          </Body>
          <Caption>{formatTNight(wallet.tNightBalance)}</Caption>
        </WalletPanel>
      </Header>

      <div
        style={{
          padding: '40px',
          background: '#fef2f2',
          border: '2px solid red',
          color: 'black',
        }}
      >
        <h1>DEBUG X-RAY VIEW</h1>
        <pre style={{ fontSize: '14px' }}>
          {JSON.stringify(
            { isLoading: isLoading || false, proposalsCount: proposals?.length || 0, proposals: proposals || [] },
            null,
            2,
          )}
        </pre>
        {(proposals?.length ?? 0) === 0 ? (
          <EmptyState title="X-ray: EmptyState mount test" description="If you see this card, EmptyState renders." />
        ) : null}
      </div>
    </div>
  );
}
