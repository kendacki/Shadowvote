"use client";

import { CreateProposalModal } from '@/components/CreateProposalModal';
import { EmptyState } from '@/components/EmptyState';
import { LoadingScreen } from '@/components/LoadingScreen';
import { PastProposalCard } from '@/components/PastProposalCard';
import { ProposalCard } from '@/components/ProposalCard';
import { SearchBar } from '@/components/SearchBar';
import { Body, H2 } from '@/components/Typography';
import { Button } from '@/components/Button';
import { useToast } from '@/contexts/ToastContext';
import { useMidnightWallet } from '@/hooks/useMidnightWallet';
import { useShadowVote, type ProposalView, type VoteTxStage } from '@/hooks/useShadowVote';
import { useSupabaseSync, type OffChainProposalRow } from '@/hooks/useSupabaseSync';
import { useVoterIdentity } from '@/hooks/useVoterIdentity';
import { styled } from '@/stitches.config';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { MOCK_PAST_PROPOSALS, pickUserHistoryImage, type PastProposalRecord } from '@/utils/mockData';
import { GOVERNANCE_MIN_TNIGHT } from '@/utils/tNightGate';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';

function normalizeLifecycleStatus(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

/** Active grid: Pending First Vote | Active, or no Supabase row (on-chain / pending only). */
function isActiveLifecycleRow(row: OffChainProposalRow | undefined): boolean {
  if (row === undefined) return true;
  const t = normalizeLifecycleStatus(row.status);
  return t === 'pending first vote' || t === 'active';
}

/** Past grid: Ended | Passed (incl. legacy copy like "Proposal Passed"). */
function isPastLifecycleRow(row: OffChainProposalRow): boolean {
  const t = normalizeLifecycleStatus(row.status);
  return t === 'ended' || t === 'passed' || t === 'proposal passed';
}

function offChainRowToPastRecord(row: OffChainProposalRow): PastProposalRecord {
  const n = Number.parseInt(String(row.id), 10);
  const seed = Number.isFinite(n) ? n : 0;
  return {
    id: `supabase-past-${row.id}`,
    title: row.title.trim() || `Proposal #${row.id}`,
    description: row.description?.trim() ?? '',
    yesVotes: 50,
    noVotes: 50,
    totalVotes: '—',
    status: row.status,
    imageUrl: pickUserHistoryImage(seed),
  };
}
const PageShell = styled(motion.div, {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  minWidth: 0,
  width: '100%',
});

/** Standard flow — spacing clears sticky TopNav; safe-area for notched devices. */
const DashboardContainer = styled('div', {
  width: '100%',
  maxWidth: '1200px',
  margin: '0 auto',
  paddingTop: '$8',
  paddingBottom: '$8',
  paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
  paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
  boxSizing: 'border-box',
});

const Hero = styled('div', {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '$4',
  marginBottom: '$8',
});

const TitleBlock = styled('div', {
  flex: '1 1 auto',
  minWidth: 'min(100%, 240px)',
});

const PageTitle = styled('h1', {
  margin: 0,
  marginBottom: '$2',
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: 'clamp($xl, 4vw, $3xl)',
  lineHeight: 1.15,
  letterSpacing: '-0.02em',
  color: '$black',
});

const Subline = styled('p', {
  margin: 0,
  fontFamily: '$poppins',
  fontWeight: '$regular',
  fontSize: '$sm',
  color: '$gray500',
  lineHeight: 1.5,
  userSelect: 'none',
});

const ProposalGrid = styled('div', {
  display: 'grid',
  gap: '24px',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
});

const SectionHeading = styled('h2', {
  margin: 0,
  marginBottom: '$5',
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$xl',
  lineHeight: 1.25,
  letterSpacing: '-0.02em',
  color: '$black',
});

const PastSection = styled('section', {
  marginTop: '60px',
});

const PastHeading = styled('h2', {
  margin: 0,
  marginBottom: '$6',
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$xl',
  lineHeight: 1.25,
  letterSpacing: '-0.02em',
  color: '$black',
});

const PastGrid = styled('div', {
  display: 'grid',
  gap: '24px',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
});

const SkeletonGrid = styled('div', {
  display: 'grid',
  gap: '24px',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
});

const SkeletonCard = styled('div', {
  height: '200px',
  borderRadius: '12px',
  border: '1px solid #E5E7EB',
  backgroundColor: '$gray100',
});

const SyncBanner = styled(motion.div, {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '$3',
  padding: '$4 $5',
  marginBottom: '$5',
  borderRadius: '$md',
  border: '1px solid #E5E7EB',
  backgroundColor: '$gray50',
});

const HookErrorPanel = styled(motion.div, {
  maxWidth: '640px',
  margin: '0 auto',
  padding: '$6 $5',
  borderRadius: '$lg',
  border: '1px solid $red400',
  backgroundColor: 'rgba(239, 68, 68, 0.06)',
});

const DisconnectPanel = styled(motion.div, {
  maxWidth: '520px',
  margin: '0 auto',
  textAlign: 'center',
});

const SearchRow = styled('div', {
  flexBasis: '100%',
  width: '100%',
  maxWidth: '560px',
  marginTop: '$5',
});

function LoadingSkeleton() {
  return (
    <SkeletonGrid aria-busy aria-label="Loading proposals">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </SkeletonGrid>
  );
}

function parseAdminPreimageHex(hex: string): Uint8Array {
  const normalized = hex.trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error('Admin preimage must be exactly 64 hexadecimal characters.');
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function applyAdminRootStageToast(
  toast: ReturnType<typeof useToast>,
  toastId: string,
  stage: VoteTxStage,
) {
  switch (stage) {
    case 'preparing':
      toast.update(toastId, {
        variant: 'loading',
        title: 'Preparing',
        message: 'Loading contract and registry Merkle root…',
      });
      break;
    case 'proving':
      toast.update(toastId, {
        variant: 'loading',
        title: 'Generating ZK proof',
        message: 'Proving update_voter_root…',
      });
      break;
    case 'submitting':
      toast.update(toastId, {
        variant: 'loading',
        title: 'Submitting',
        message: 'Signing and sending the root update via Lace.',
      });
      break;
    case 'confirmed':
      toast.update(toastId, {
        variant: 'success',
        title: 'Root updated',
        message: 'On-chain voter Merkle root now matches config/voter-registry.json.',
      });
      break;
    case 'failed_insufficient_balance':
      toast.update(toastId, {
        variant: 'error',
        title: 'Insufficient tNIGHT',
        message: 'Fund your unshielded balance to pay fees for the admin transaction.',
      });
      break;
    case 'failed_user_rejected':
      toast.update(toastId, {
        variant: 'error',
        title: 'Cancelled',
        message: 'The wallet did not submit the transaction.',
      });
      break;
    case 'failed_network':
      toast.update(toastId, {
        variant: 'error',
        title: 'Network error',
        message: 'Could not complete the request.',
      });
      break;
    case 'failed':
      toast.update(toastId, {
        variant: 'error',
        title: 'Update failed',
        message: 'See error details in the alert below.',
      });
      break;
    default:
      break;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const wallet = useMidnightWallet();
  const api = wallet.isConnected ? wallet.getConnectedApi() : null;
  const identity = useVoterIdentity(api, {
    isWalletConnected: wallet.isConnected,
    tNightBalance: wallet.tNightBalance,
  });
  const shadowVote = useShadowVote(api, identity?.voterSecret ?? null);
  const { offChainProposals } = useSupabaseSync();

  const proposals = shadowVote?.proposals;
  const isLoading = shadowVote?.isLoadingProposals ?? false;
  const shadowError = shadowVote?.error ?? null;
  const isVoting = shadowVote?.isVoting ?? false;
  const syncError = shadowVote?.syncError ?? null;
  const clearShadowError = shadowVote?.clearError ?? (() => {});
  const clearSyncError = shadowVote?.clearSyncError ?? (() => {});

  const safeProposals = Array.isArray(proposals) ? proposals : [];
  const allProposals = shadowVote?.allProposals ?? safeProposals;

  const supabaseAsProposalViews = useMemo(() => {
    const out: ProposalView[] = [];
    for (const row of offChainProposals) {
      const n = Number.parseInt(String(row.id), 10);
      if (!Number.isFinite(n) || n < 0 || n > 0xffffffff) continue;
      out.push({ id: n, tally: 0 });
    }
    return out;
  }, [offChainProposals]);

  /** On-chain + pending + global overlay, merged with Supabase waiting-room rows (tally 0 until indexed). */
  const allProposalsUnified = useMemo(() => {
    const byId = new Map<number, ProposalView>();
    for (const p of allProposals) {
      byId.set(p.id, { ...p });
    }
    for (const p of supabaseAsProposalViews) {
      if (!byId.has(p.id)) {
        byId.set(p.id, { id: p.id, tally: 0 });
      }
    }
    return [...byId.values()].sort((a, b) => a.id - b.id);
  }, [allProposals, supabaseAsProposalViews]);

  const statusFilteredActiveProposals = useMemo(() => {
    return allProposalsUnified.filter((p) => {
      const row = offChainProposals.find((r) => String(r.id) === String(p.id));
      return isActiveLifecycleRow(row);
    });
  }, [allProposalsUnified, offChainProposals]);

  const supabasePastRecords = useMemo(
    () => offChainProposals.filter(isPastLifecycleRow).map(offChainRowToPastRecord),
    [offChainProposals],
  );

  const allPastForGrid = useMemo(
    () => [...supabasePastRecords, ...MOCK_PAST_PROPOSALS],
    [supabasePastRecords],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const searchNormalized = searchQuery.trim().toLowerCase();

  const filteredActiveProposals = useMemo(() => {
    if (!searchNormalized) return statusFilteredActiveProposals;
    return statusFilteredActiveProposals.filter((p) => {
      let titleLs = '';
      try {
        const raw = localStorage.getItem('shadowvote.proposalTitles.v1');
        const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
        const t = map[String(p.id)];
        titleLs = typeof t === 'string' ? t.toLowerCase() : '';
      } catch {
        /* ignore */
      }
      const matchRow = offChainProposals.find((r) => String(r.id) === String(p.id));
      const sbTitle = matchRow?.title?.toLowerCase() ?? '';
      const sbDesc = matchRow?.description?.toLowerCase() ?? '';
      let descLs = '';
      try {
        const dr = localStorage.getItem('shadowvote.proposalDescriptions.v1');
        const dm = dr ? (JSON.parse(dr) as Record<string, string>) : {};
        const d = dm[String(p.id)];
        descLs = typeof d === 'string' ? d.toLowerCase() : '';
      } catch {
        /* ignore */
      }
      return (
        String(p.id).toLowerCase().includes(searchNormalized) ||
        titleLs.includes(searchNormalized) ||
        sbTitle.includes(searchNormalized) ||
        sbDesc.includes(searchNormalized) ||
        descLs.includes(searchNormalized)
      );
    });
  }, [statusFilteredActiveProposals, offChainProposals, searchNormalized, searchQuery]);

  const filteredPastProposals = useMemo(() => {
    if (!searchNormalized) return allPastForGrid;
    return allPastForGrid.filter(
      (p) =>
        p.title.toLowerCase().includes(searchNormalized) ||
        p.id.toLowerCase().includes(searchNormalized),
    );
  }, [allPastForGrid, searchNormalized, searchQuery]);

  const showSearchEmpty =
    searchNormalized.length > 0 &&
    filteredActiveProposals.length === 0 &&
    filteredPastProposals.length === 0;

  const identityReady =
    Boolean(identity?.isReady) && identity?.voterSecret != null && identity.voterSecret.length === 32;

  const adminTapRef = useRef({ count: 0, at: 0 });
  const [adminPanelRevealed, setAdminPanelRevealed] = useState(false);
  const bumpAdminPanelUnlock = useCallback(() => {
    const now = Date.now();
    if (now - adminTapRef.current.at > 1600) adminTapRef.current.count = 0;
    adminTapRef.current.at = now;
    adminTapRef.current.count += 1;
    if (adminTapRef.current.count >= 3) {
      setAdminPanelRevealed(true);
      adminTapRef.current.count = 0;
    }
  }, []);

  const deployerUnshielded = process.env.NEXT_PUBLIC_SHADOWVOTE_DEPLOYER_UNSHIELDED?.trim() ?? '';
  const isDeployerWallet =
    deployerUnshielded.length > 0 &&
    wallet.unshieldedAddress != null &&
    deployerUnshielded.toLowerCase() === wallet.unshieldedAddress.toLowerCase();

  const runAdminRootSync = useCallback(async () => {
    const hex = typeof window !== 'undefined' ? window.prompt('Admin preimage (64 hex chars)', '') : null;
    if (!hex) return;
    let preimage: Uint8Array;
    try {
      preimage = parseAdminPreimageHex(hex);
    } catch (e: unknown) {
      toast.error('Invalid preimage', e instanceof Error ? e.message : 'Invalid input');
      return;
    }
    const fn = shadowVote?.updateVoterRootFromRegistry;
    if (typeof fn !== 'function') return;
    const toastId = toast.loading('Preparing', 'Syncing voter Merkle root…');
    try {
      await fn(preimage, (stage) => applyAdminRootStageToast(toast, toastId, stage));
    } catch {
      /* toast + shadowVote.error */
    }
  }, [shadowVote, toast]);

  const registerPending = shadowVote?.registerPendingProposal;

  const handleCreateProposal = useCallback(
    ({ proposalId, title, description }: { proposalId: number; title: string; description: string }) => {
      registerPending?.(proposalId);
      try {
        const titleRaw = localStorage.getItem('shadowvote.proposalTitles.v1');
        const titleMap: Record<string, string> = titleRaw ? (JSON.parse(titleRaw) as Record<string, string>) : {};
        if (title.trim()) titleMap[String(proposalId)] = title.trim();
        localStorage.setItem('shadowvote.proposalTitles.v1', JSON.stringify(titleMap));

        const descRaw = localStorage.getItem('shadowvote.proposalDescriptions.v1');
        const descMap: Record<string, string> = descRaw ? (JSON.parse(descRaw) as Record<string, string>) : {};
        if (description.trim()) descMap[String(proposalId)] = description.trim();
        localStorage.setItem('shadowvote.proposalDescriptions.v1', JSON.stringify(descMap));
      } catch {
        /* ignore */
      }
    },
    [registerPending],
  );

  if (wallet?.isLoading) {
    return (
      <PageShell initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <LoadingScreen message="Loading wallet…" variant="light" />
        <CreateProposalModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateProposal}
          isSubmitting={isVoting}
        />
      </PageShell>
    );
  }

  if (!wallet?.isConnected || !wallet?.unshieldedAddress) {
    return (
      <PageShell initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <DashboardContainer>
          <DisconnectPanel initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <PageTitle css={{ marginBottom: '$4' }}>Connect your wallet</PageTitle>
            <Body css={{ marginBottom: '$6', fontFamily: '$poppins' }}>
              Use <strong>Connect wallet</strong> in the navigation bar (Lace on Preprod), or go <strong>home</strong>{' '}
              and use <strong>Connect</strong> → <strong>Open app</strong>.
            </Body>
            <Button type="button" variant="primary" onClick={() => router.push('/')}>
              Return home
            </Button>
          </DisconnectPanel>
        </DashboardContainer>
      </PageShell>
    );
  }

  let proposalBody: ReactNode;
  if (isLoading && statusFilteredActiveProposals.length === 0 && !searchNormalized) {
    proposalBody = <LoadingSkeleton />;
  } else if (shadowError) {
    proposalBody = (
      <HookErrorPanel
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        role="alert"
      >
        <H2 css={{ marginTop: 0, marginBottom: '$3', fontSize: '$lg', color: '$red400', fontFamily: '$poppins' }}>
          Could not load proposals
        </H2>
        <Body css={{ color: '$gray600', marginBottom: '$5', fontFamily: '$poppins' }}>{String(shadowError)}</Body>
        <Button type="button" variant="secondary" onClick={() => clearShadowError()}>
          Dismiss
        </Button>
      </HookErrorPanel>
    );
  } else if (showSearchEmpty) {
    proposalBody = (
      <Body css={{ fontFamily: '$poppins', fontWeight: '$regular', color: '$gray600', marginBottom: '$4' }}>
        No proposals match your search.
      </Body>
    );
  } else if (statusFilteredActiveProposals.length === 0 && !searchNormalized) {
    proposalBody = (
      <EmptyState
        onOpenModal={() => setIsModalOpen(true)}
        disabled={!identityReady || isVoting}
      />
    );
  } else if (searchNormalized) {
    proposalBody =
      filteredActiveProposals.length > 0 ? (
        <ProposalGrid>
          {filteredActiveProposals.map((p, i) => (
            <ProposalCard key={p.id} proposalId={p.id} tally={p.tally} index={i} />
          ))}
        </ProposalGrid>
      ) : null;
  } else {
    proposalBody = (
      <ProposalGrid>
        {statusFilteredActiveProposals.map((p, i) => (
          <ProposalCard key={p.id} proposalId={p.id} tally={p.tally} index={i} />
        ))}
      </ProposalGrid>
    );
  }

  return (
    <PageShell initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <DashboardContainer>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Hero>
            <TitleBlock>
              <PageTitle>Governance Dashboard</PageTitle>
              <Subline onClick={bumpAdminPanelUnlock}>
                {identity.blockedByFundThreshold ? (
                  <>
                    Insufficient tNIGHT: you need at least {GOVERNANCE_MIN_TNIGHT.toString()} unshielded testnet tNIGHT
                    in Lace before this browser can generate your voter credential and cast votes.
                  </>
                ) : identityReady ? (
                  'Voter identity ready below — create or open a proposal.'
                ) : (
                  'Preparing secure voter identity…'
                )}
              </Subline>
            </TitleBlock>
            <Button
              type="button"
              variant="primary"
              disabled={!identityReady || isVoting}
              onClick={() => setIsModalOpen(true)}
            >
              New Proposal
            </Button>
            <SearchRow>
              <SearchBar value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </SearchRow>
          </Hero>

          {wallet?.error ? (
            <Body css={{ color: '$red400', marginBottom: '$4', fontFamily: '$poppins' }}>{wallet.error}</Body>
          ) : null}

          {adminPanelRevealed && isDeployerWallet ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginBottom: 20,
                padding: 16,
                borderRadius: 8,
                border: '1px solid #FECACA',
                backgroundColor: 'rgba(254, 202, 202, 0.25)',
              }}
            >
              <Body
                css={{
                  fontFamily: '$poppins',
                  fontSize: '$sm',
                  color: '$gray700',
                  marginBottom: '$3',
                  marginTop: 0,
                }}
              >
                Admin: push the Merkle root from <code>config/voter-registry.json</code> on-chain (
                <code>update_voter_root</code>). Requires a contract built from the latest{' '}
                <code>shadowvote.compact</code> and matching ZK artifacts.
              </Body>
              <Button type="button" variant="secondary" disabled={isVoting} onClick={() => void runAdminRootSync()}>
                {isVoting ? 'Working…' : 'Sync on-chain voter root'}
              </Button>
            </motion.div>
          ) : null}

          {syncError ? (
            <SyncBanner
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <Body css={{ fontSize: '$sm', color: '$gray600', margin: 0, fontFamily: '$poppins' }}>
                Live sync: {syncError}
              </Body>
              <Button type="button" variant="secondary" onClick={() => clearSyncError()}>
                Dismiss
              </Button>
            </SyncBanner>
          ) : null}

          <SectionHeading>Active Proposals</SectionHeading>
          {proposalBody}

          <PastSection aria-labelledby="dashboard-past-proposals-heading">
            <PastHeading id="dashboard-past-proposals-heading">Past Proposals</PastHeading>
            <PastGrid>
              {showSearchEmpty
                ? null
                : (searchNormalized ? filteredPastProposals : allPastForGrid).map((p, i) => (
                    <PastProposalCard key={p.id} proposal={p} index={i} />
                  ))}
            </PastGrid>
          </PastSection>
        </motion.div>
      </DashboardContainer>

      <CreateProposalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateProposal}
        isSubmitting={isVoting}
      />
    </PageShell>
  );
}
