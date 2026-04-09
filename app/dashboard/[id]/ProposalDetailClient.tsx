'use client';

import { LoadingScreen } from '@/components/LoadingScreen';
import { PageContainer } from '@/components/PageContainer';
import { VoteResults } from '@/components/VoteResults';
import { Body, H1 } from '@/components/Typography';
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

const Page = styled(motion.div, {
  minHeight: '100vh',
  backgroundColor: '#FFFFFF',
});

const MainMotion = styled(motion.div, {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '$6',
});

const BackLink = styled(Link, {
  fontFamily: '$poppins',
  fontSize: '$sm',
  fontWeight: '$semibold',
  color: '$red400',
  textDecoration: 'none',
  marginBottom: '$2',
  display: 'inline-block',
  '&:hover': { textDecoration: 'underline' },
});

const PageHeading = styled('h1', {
  margin: 0,
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: 'clamp($xl, 3vw, $2xl)',
  lineHeight: 1.2,
  color: '$black',
  letterSpacing: '-0.02em',
});

const StatHero = styled(motion.div, {
  padding: '$6',
  borderRadius: '$lg',
  border: '1px solid #E5E7EB',
  background: `linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(185, 28, 28, 0.12) 100%)`,
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
});

const StatLabel = styled('span', {
  display: 'block',
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$sm',
  color: '$gray600',
  marginBottom: '$2',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
});

const StatValue = styled('span', {
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$3xl',
  letterSpacing: '-0.03em',
  color: '$black',
  background: gradientPrimary,
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
});

const SyncBanner = styled(motion.div, {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '$3',
  padding: '$4 $5',
  borderRadius: '$md',
  border: '1px solid #E5E7EB',
  backgroundColor: '$gray50',
});

const ErrorPanel = styled(motion.div, {
  padding: '$5',
  borderRadius: '$lg',
  border: '1px solid #E5E7EB',
  backgroundColor: '$gray50',
});

const Actions = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '$4',
  alignItems: 'flex-start',
});

const VoteCastPill = styled(motion.div, {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  maxWidth: '400px',
  padding: '$3 $6',
  borderRadius: '$pill',
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$md',
  color: '$white',
  background: gradientPrimary,
  boxShadow: '$buttonPrimary',
  '@sm': { width: 'auto', minWidth: '220px' },
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
  const api = wallet?.getConnectedApi?.() ?? null;
  const identity = useVoterIdentity();
  const shadow = useShadowVote(api, identity?.voterSecret ?? null);

  const identityReady =
    Boolean(identity?.isReady) && identity?.voterSecret != null && identity.voterSecret.length === 32;

  const row = useMemo(() => shadow.proposals.find((p) => p.id === proposalId), [shadow.proposals, proposalId]);
  const tally = row?.tally ?? 0;
  const totalVotesAllProposals = useMemo(
    () => shadow.proposals.reduce((acc, p) => acc + p.tally, 0),
    [shadow.proposals],
  );

  const hasVoted = identityReady && shadow.checkHasVoted(String(proposalId));

  const runVoteWithToast = useCallback(async () => {
    const cast = shadow?.castVote;
    if (typeof cast !== 'function') return;
    const toastId = toast.loading('Preparing', 'Initializing transaction…');
    await cast(proposalId, (stage) => applyVoteStageToast(toast, toastId, proposalId, stage));
  }, [shadow, toast, proposalId]);

  if (wallet.isLoading) {
    return <LoadingScreen message="Loading wallet…" variant="light" />;
  }

  if (!wallet.isConnected || !wallet.unshieldedAddress) {
    return (
      <Page initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <PageContainer>
          <ErrorPanel initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <H1 css={{ marginTop: 0, marginBottom: '$4', fontFamily: '$poppins' }}>Connect your wallet</H1>
            <Body css={{ marginBottom: '$6', color: '$gray500', fontFamily: '$poppins' }}>
              Connect Lace from the top bar, then open this proposal again.
            </Body>
            <Button type="button" variant="primary" onClick={() => router.push('/')}>
              Return home
            </Button>
          </ErrorPanel>
        </PageContainer>
      </Page>
    );
  }

  return (
    <Page initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <PageContainer>
        <MainMotion
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <BackLink href="/dashboard">← Back to Dashboard</BackLink>
            <PageHeading>Proposal #{proposalId}</PageHeading>
          </div>

          <StatHero
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <StatLabel>Current vote tally</StatLabel>
            <StatValue>{tally}</StatValue>
          </StatHero>

          {identityReady ? (
            <Body css={{ fontSize: '$sm', color: '$gray500', fontFamily: '$poppins', margin: 0 }}>
              Local voter identity is ready.
            </Body>
          ) : (
            <Body css={{ fontSize: '$sm', color: '$gray500', fontFamily: '$poppins', margin: 0 }}>
              Loading secure voter identity…
            </Body>
          )}

          {shadow.syncError ? (
            <SyncBanner
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <Body css={{ fontSize: '$sm', color: '$gray600', margin: 0, fontFamily: '$poppins' }}>
                Live sync: {shadow.syncError}
              </Body>
              <Button type="button" variant="secondary" onClick={() => shadow.clearSyncError()}>
                Dismiss
              </Button>
            </SyncBanner>
          ) : null}

          {wallet.error ? <Body css={{ color: '$red400', fontFamily: '$poppins' }}>{wallet.error}</Body> : null}
          {shadow.error ? (
            <ErrorPanel
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <Body css={{ color: '$red400', margin: 0, fontFamily: '$poppins' }}>{shadow.error}</Body>
            </ErrorPanel>
          ) : null}

          {!shadow.isLoadingProposals && shadow.proposals.length > 0 && !row ? (
            <Body css={{ color: '$gray500', fontSize: '$sm', fontFamily: '$poppins' }}>
              This proposal id is not in the on-chain map yet (no votes recorded). You can still cast the first vote —
              the contract will initialize the tally.
            </Body>
          ) : null}

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
            <Body css={{ fontSize: '$sm', color: '$gray500', maxWidth: '480px', fontFamily: '$poppins', margin: 0 }}>
              One anonymous vote per identity per proposal. If you have already voted, this switches to
              &quot;Vote recorded&quot; when the indexer syncs.
            </Body>
          </Actions>
        </MainMotion>
      </PageContainer>
    </Page>
  );
}
