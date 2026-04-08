'use client';

import { VoteResults } from '@/components/VoteResults';
import { Body, Caption, H1, H2 } from '@/components/Typography';
import { Button } from '@/components/Button';
import { useToast } from '@/contexts/ToastContext';
import { useMidnightWallet } from '@/hooks/useMidnightWallet';
import { useShadowVote, type VoteTxStage } from '@/hooks/useShadowVote';
import { useVoterIdentity } from '@/hooks/useVoterIdentity';
import { gradientPrimary, styled } from '@/stitches.config';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { truncateAddress } from '@/utils/formatters';

const Page = styled(motion.div, {
  minHeight: '100vh',
  backgroundColor: '$white',
});

const Header = styled('header', {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '$4',
  maxWidth: '1120px',
  margin: '0 auto',
  padding: '$6 max($5, env(safe-area-inset-left, 0px)) $6 max($5, env(safe-area-inset-right, 0px))',
  '@md': { padding: '$6 max($7, env(safe-area-inset-left, 0px)) $6 max($7, env(safe-area-inset-right, 0px))' },
});

const BackLink = styled(Link, {
  fontFamily: '$poppins',
  fontSize: '$sm',
  fontWeight: '$semibold',
  color: '$red400',
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
});

const Main = styled('main', {
  maxWidth: '1120px',
  margin: '0 auto',
  padding: '$5 max($5, env(safe-area-inset-left, 0px)) $9 max($5, env(safe-area-inset-right, 0px))',
  '@md': { padding: '$6 max($7, env(safe-area-inset-left, 0px)) $9 max($7, env(safe-area-inset-right, 0px))' },
  display: 'flex',
  flexDirection: 'column',
  gap: '$6',
});

const Actions = styled('div', {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '$3',
  alignItems: 'center',
});

const WalletCol = styled('div', {
  textAlign: 'left',
  width: '100%',
  '@sm': { textAlign: 'right', width: 'auto' },
});

const SyncBanner = styled(motion.div, {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '$3',
  padding: '$4 $5',
  borderRadius: '$md',
  border: '1px solid $gray200',
  backgroundColor: '$gray100',
});

const ErrorPanel = styled(motion.div, {
  padding: '$5',
  borderRadius: '$lg',
  border: '1px solid $gray200',
  backgroundColor: '$gray50',
});

const VoteCastPill = styled(motion.div, {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minWidth: '0',
  maxWidth: '400px',
  padding: '$3 $6',
  borderRadius: '$pill',
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$md',
  color: '$white',
  background: gradientPrimary,
  boxShadow: '$buttonPrimary',
  '@sm': { width: 'auto', minWidth: '200px' },
});

function applyVoteStageToast(
  toast: ReturnType<typeof useToast>,
  toastId: string,
  proposalId: number,
  stage: VoteTxStage,
) {
  switch (stage) {
    case 'preparing':
      toast.update(toastId, {
        variant: 'loading',
        title: 'Preparing',
        message: 'Building Merkle witness and contract state…',
      });
      break;
    case 'proving':
      toast.update(toastId, {
        variant: 'loading',
        title: 'Generating ZK proof',
        message: 'Proving circuit in your browser — this can take a while.',
      });
      break;
    case 'submitting':
      toast.update(toastId, {
        variant: 'loading',
        title: 'Submitting to network',
        message: 'Balancing and relaying the transaction via Lace.',
      });
      break;
    case 'confirmed':
      toast.update(toastId, {
        variant: 'success',
        title: 'Confirmed',
        message: `Vote recorded for proposal #${proposalId}.`,
      });
      break;
    case 'failed_user_rejected':
      toast.update(toastId, {
        variant: 'error',
        title: 'Transaction cancelled',
        message: 'The wallet did not sign or submit the transaction.',
      });
      break;
    case 'failed_already_voted':
      toast.update(toastId, {
        variant: 'error',
        title: 'Already voted',
        message: `Your identity already cast a vote on proposal #${proposalId}.`,
      });
      break;
    case 'failed_network':
      toast.update(toastId, {
        variant: 'error',
        title: 'Network error',
        message: 'Could not complete the request. Check your connection and try again.',
      });
      break;
    case 'failed':
      toast.update(toastId, {
        variant: 'error',
        title: 'Failed',
        message: 'The transaction did not complete. See the message below.',
      });
      break;
    default:
      break;
  }
}

export type ProposalDetailClientProps = {
  proposalId: number;
};

export default function ProposalDetailClient({ proposalId }: ProposalDetailClientProps) {
  const router = useRouter();
  const toast = useToast();
  const wallet = useMidnightWallet();
  const api = wallet.getConnectedApi();
  const identity = useVoterIdentity();
  const shadow = useShadowVote(api, identity.voterSecret);

  const identityReady = identity.isReady && identity.voterSecret !== null && identity.voterSecret.length === 32;

  const row = useMemo(() => shadow.proposals.find((p) => p.id === proposalId), [shadow.proposals, proposalId]);
  const tally = row?.tally ?? 0;
  const totalVotesAllProposals = useMemo(
    () => shadow.proposals.reduce((acc, p) => acc + p.tally, 0),
    [shadow.proposals],
  );

  const hasVoted = identityReady && shadow.checkHasVoted(String(proposalId));

  const runVoteWithToast = useCallback(async () => {
    const toastId = toast.loading('Preparing', 'Initializing transaction…');
    await shadow.castVote(proposalId, (stage) => applyVoteStageToast(toast, toastId, proposalId, stage));
  }, [shadow, toast, proposalId]);

  if (wallet.isLoading) {
    return (
      <Page initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Main>
          <Body>Loading wallet…</Body>
        </Main>
      </Page>
    );
  }

  if (!wallet.isConnected || !wallet.unshieldedAddress) {
    return (
      <Page initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Main>
          <ErrorPanel initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <H1 css={{ marginTop: 0, marginBottom: '$4' }}>Connect your wallet</H1>
            <Body css={{ marginBottom: '$6', color: '$gray500' }}>
              Open a proposal vote on ShadowVote after connecting Lace on Preprod.
            </Body>
            <Button type="button" variant="primary" onClick={() => router.push('/')}>
              Return home
            </Button>
          </ErrorPanel>
        </Main>
      </Page>
    );
  }

  return (
    <Page initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <Header>
        <div>
          <Caption css={{ marginBottom: '$2' }}>
            <BackLink href="/dashboard">← Back to dashboard</BackLink>
          </Caption>
          <H2>Proposal #{proposalId}</H2>
        </div>
        <WalletCol>
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
        </WalletCol>
      </Header>

      <Main>
        {identityReady ? (
          <Body css={{ fontSize: '$sm', color: '$gray500' }}>Local voter identity is ready.</Body>
        ) : (
          <Body css={{ fontSize: '$sm', color: '$gray500' }}>Loading secure voter identity…</Body>
        )}

        {shadow.syncError && (
          <SyncBanner
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Body css={{ fontSize: '$sm', color: '$gray600', margin: 0 }}>Live sync: {shadow.syncError}</Body>
            <Button type="button" variant="secondary" onClick={() => shadow.clearSyncError()}>
              Dismiss
            </Button>
          </SyncBanner>
        )}

        {wallet.error && <Body css={{ color: '$red400' }}>{wallet.error}</Body>}
        {shadow.error && (
          <ErrorPanel
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Body css={{ color: '$red400', margin: 0 }}>{shadow.error}</Body>
          </ErrorPanel>
        )}

        {!shadow.isLoadingProposals && shadow.proposals.length > 0 && !row && (
          <Body css={{ color: '$gray500', fontSize: '$sm' }}>
            This proposal id is not in the on-chain map yet (no votes recorded). You can still cast the first vote —
            the contract will initialize the tally.
          </Body>
        )}

        <VoteResults proposalId={proposalId} tally={tally} totalVotesAllProposals={totalVotesAllProposals} />

        <Actions>
          <AnimatePresence mode="wait" initial={false}>
            {hasVoted ? (
              <VoteCastPill
                key="done"
                role="status"
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                Vote recorded
              </VoteCastPill>
            ) : (
              <motion.div
                key="vote"
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <Button
                  type="button"
                  variant="primary"
                  disabled={!identityReady || shadow.isVoting}
                  onClick={() => void runVoteWithToast()}
                >
                  {shadow.isVoting ? 'Proving & submitting…' : 'Cast Vote'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <Body css={{ fontSize: '$sm', color: '$gray500', maxWidth: '420px' }}>
            One vote per voter identity per proposal Sybil resistance uses a disclosed nullifier. If you have already
            voted, the button becomes &quot;Vote cast&quot; when the indexer syncs.
          </Body>
        </Actions>
      </Main>
    </Page>
  );
}
