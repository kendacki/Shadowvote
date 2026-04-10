'use client';

import '@/lib/ensureMidnightNetworkId';
import { findDeployedContract, getPublicStates } from '@midnight-ntwrk/midnight-js-contracts';
import type { ChargedState, ContractState, StateValue } from '@midnight-ntwrk/compact-runtime';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { auditTime, Subscription } from 'rxjs';
import {
  createShadowVoteProviders,
  createShadowVotePublicDataProvider,
} from '@/lib/createShadowVoteProviders';
import { loadCompiledShadowVoteContract } from '@/lib/loadCompiledShadowVote';
import { SHADOWVOTE_ADDRESS, SHADOWVOTE_PRIVATE_STATE_ID } from '@/src/config/contracts';
import { MOCK_PAST_PROPOSALS } from '@/utils/mockData';
import { assertMinGovernanceBalance } from '@/utils/tNightGate';
import { classifyVoteFailure, computeVoteNullifier, bytes32ToLowerHex } from '../utils/crypto';

export type ProposalView = {
  id: number;
  tally: number;
};

/** Lifecycle for long-running ZK + wallet submission flows. */
export type VoteTxStage =
  | 'preparing'
  | 'proving'
  | 'submitting'
  | 'confirmed'
  | 'failed'
  | 'failed_user_rejected'
  | 'failed_already_voted'
  | 'failed_insufficient_balance'
  | 'failed_network';

type ContractMod = typeof import('@shadowvote/contract');

function nullifierSetFromLedger(ledgerView: ReturnType<ContractMod['ledger']>): Set<string> {
  const set = new Set<string>();
  for (const n of ledgerView.nullifiers) {
    set.add(bytes32ToLowerHex(n));
  }
  return set;
}

function proposalsFromLedger(ledgerView: ReturnType<ContractMod['ledger']>): ProposalView[] {
  const out: ProposalView[] = [];
  for (const [id, tally] of ledgerView.proposals) {
    out.push({ id: Number(id), tally: Number(tally) });
  }
  out.sort((a, b) => a.id - b.id);
  return out;
}

function ledgerSnapshotDigest(proposals: ProposalView[], nullifiers: Set<string>): string {
  const p = proposals.map((x) => `${x.id}:${x.tally}`).join('\u001f');
  const n = [...nullifiers].sort().join('\u001f');
  return `${p}\u001e${n}`;
}

const PENDING_PROPOSAL_IDS_KEY = 'shadowvote.pendingProposalIds.v1';
const VOTE_CHOICE_KEY = 'shadowvote.proposalVoteChoice.v1';

function persistVoteChoice(proposalId: number, choice: boolean): void {
  try {
    const raw = localStorage.getItem(VOTE_CHOICE_KEY);
    const map: Record<string, 'yes' | 'no'> = raw ? (JSON.parse(raw) as Record<string, 'yes' | 'no'>) : {};
    map[String(proposalId)] = choice ? 'yes' : 'no';
    localStorage.setItem(VOTE_CHOICE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function readPendingProposalIds(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_PROPOSAL_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => (typeof x === 'number' ? x : Number(x)))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 0xffffffff);
  } catch {
    return [];
  }
}

function writePendingProposalIds(ids: number[]) {
  try {
    localStorage.setItem(PENDING_PROPOSAL_IDS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

function contractStateArgForLedgerView(state: ContractState): ChargedState | StateValue {
  const withData = state as ContractState & { data?: ChargedState };
  if (withData.data != null) {
    return withData.data;
  }
  return state as unknown as ChargedState;
}

async function ledgerSnapshotFromContractState(contractState: ContractState): Promise<{
  proposals: ProposalView[];
  nullifiers: Set<string>;
}> {
  const mod: ContractMod = await import('@shadowvote/contract');
  const ledgerView = mod.ledger(contractStateArgForLedgerView(contractState) as unknown as StateValue);
  return {
    proposals: proposalsFromLedger(ledgerView),
    nullifiers: nullifierSetFromLedger(ledgerView),
  };
}

/**
 * @param voterSecret - 32-byte persistent secret from {@link useVoterIdentity}; used for on-chain nullifiers.
 */
export function useShadowVote(connectedApi: ConnectedAPI | null, voterSecret: Uint8Array | null) {
  const [chainProposals, setChainProposals] = useState<ProposalView[]>([]);
  const [pendingProposalIds, setPendingProposalIds] = useState<number[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [nullifierEpoch, setNullifierEpoch] = useState(0);
  const nullifiersRef = useRef<Set<string>>(new Set());
  const providersRef = useRef<Awaited<ReturnType<typeof createShadowVoteProviders>> | null>(null);
  const chainProposalsRef = useRef<ProposalView[]>([]);
  const applyLedgerGenerationRef = useRef(0);
  const lastLedgerDigestRef = useRef<string | null>(null);

  useEffect(() => {
    chainProposalsRef.current = chainProposals;
  }, [chainProposals]);

  useEffect(() => {
    setPendingProposalIds(readPendingProposalIds());
  }, []);

  useEffect(() => {
    const onChain = new Set(chainProposals.map((p) => p.id));
    setPendingProposalIds((prev) => {
      const next = prev.filter((id) => !onChain.has(id));
      if (next.length === prev.length) return prev;
      writePendingProposalIds(next);
      return next;
    });
  }, [chainProposals]);

  const proposals = useMemo(() => {
    const onChain = new Map(chainProposals.map((p) => [p.id, p] as const));
    const merged: ProposalView[] = [...chainProposals];
    for (const id of pendingProposalIds) {
      if (!onChain.has(id)) merged.push({ id, tally: 0 });
    }
    merged.sort((a, b) => a.id - b.id);
    return merged;
  }, [chainProposals, pendingProposalIds]);

  const fetchGlobalProposals = useCallback(async (): Promise<ProposalView[]> => {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 280);
    });
    return [];
  }, []);

  const [globalProposals, setGlobalProposals] = useState<ProposalView[]>([]);

  useEffect(() => {
    if (!connectedApi) {
      applyLedgerGenerationRef.current += 1;
      lastLedgerDigestRef.current = null;
      setGlobalProposals([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchGlobalProposals();
        if (!cancelled) setGlobalProposals(rows);
      } catch {
        if (!cancelled) setGlobalProposals([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connectedApi, fetchGlobalProposals]);

  const allProposals = useMemo(() => {
    const byId = new Map<number, ProposalView>();
    for (const p of proposals) {
      byId.set(p.id, { ...p });
    }
    for (const p of globalProposals) {
      const cur = byId.get(p.id);
      if (!cur) {
        byId.set(p.id, { ...p });
      } else {
        byId.set(p.id, { id: p.id, tally: Math.max(cur.tally, p.tally) });
      }
    }
    const out = [...byId.values()];
    out.sort((a, b) => a.id - b.id);
    return out;
  }, [proposals, globalProposals]);

  const allPastProposals = useMemo(() => [...MOCK_PAST_PROPOSALS], []);

  const applyContractState = useCallback(async (contractState: ContractState) => {
    const gen = ++applyLedgerGenerationRef.current;
    const { proposals: next, nullifiers: nextNulls } = await ledgerSnapshotFromContractState(contractState);
    if (gen !== applyLedgerGenerationRef.current) return;

    setSyncError(null);

    const digest = ledgerSnapshotDigest(next, nextNulls);
    if (digest === lastLedgerDigestRef.current) {
      return;
    }
    lastLedgerDigestRef.current = digest;

    setChainProposals(next);
    nullifiersRef.current = nextNulls;
    setNullifierEpoch((e) => e + 1);
  }, []);

  const registerPendingProposal = useCallback((id: number) => {
    if (!Number.isFinite(id) || id < 0 || id > 0xffffffff) return;
    if (chainProposalsRef.current.some((p) => p.id === id)) return;
    setPendingProposalIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id].sort((a, b) => a - b);
      writePendingProposalIds(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!connectedApi) {
      setIsLoadingProposals(false);
      return;
    }
    setIsLoadingProposals(true);
    let sub: Subscription | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const run = async () => {
      try {
        lastLedgerDigestRef.current = null;
        const { publicDataProvider } = await createShadowVotePublicDataProvider(connectedApi);
        if (cancelled) return;

        const pull = async () => {
          try {
            const states = await getPublicStates(publicDataProvider, SHADOWVOTE_ADDRESS);
            await applyContractState(states.contractState);
          } catch (e: unknown) {
            setSyncError(e instanceof Error ? e.message : 'Failed to sync contract state');
          }
        };

        try {
          await pull();
        } finally {
          if (!cancelled) setIsLoadingProposals(false);
        }

        sub = publicDataProvider
          .contractStateObservable(SHADOWVOTE_ADDRESS, { type: 'latest' })
          .pipe(auditTime(500))
          .subscribe({
            next: (state) => {
              void applyContractState(state).catch(() => {
                setSyncError('Failed to apply contract state update');
              });
            },
            error: (err: unknown) => {
              setSyncError(err instanceof Error ? err.message : 'Live sync disconnected');
            },
          });

        interval = setInterval(() => void pull(), 12_000);
      } catch (e: unknown) {
        setSyncError(e instanceof Error ? e.message : 'Failed to start chain sync');
        setIsLoadingProposals(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      applyLedgerGenerationRef.current += 1;
      sub?.unsubscribe();
      if (interval !== undefined) clearInterval(interval);
    };
  }, [connectedApi, applyContractState]);

  const fetchProposals = useCallback(async (): Promise<ProposalView[]> => {
    setError(null);
    if (!connectedApi) {
      lastLedgerDigestRef.current = null;
      setChainProposals([]);
      nullifiersRef.current = new Set();
      setNullifierEpoch((e) => e + 1);
      return [];
    }
    setIsLoadingProposals(true);
    try {
      const { publicDataProvider } = await createShadowVotePublicDataProvider(connectedApi);
      const states = await getPublicStates(publicDataProvider, SHADOWVOTE_ADDRESS);
      await applyContractState(states.contractState);
      const mod: ContractMod = await import('@shadowvote/contract');
      const ledgerView = mod.ledger(contractStateArgForLedgerView(states.contractState) as unknown as StateValue);
      return proposalsFromLedger(ledgerView);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load proposals';
      setError(msg);
      throw e;
    } finally {
      setIsLoadingProposals(false);
    }
  }, [connectedApi, applyContractState]);

  const checkHasVoted = useCallback(
    (proposalId: string): boolean => {
      void nullifierEpoch;
      if (!voterSecret || voterSecret.length !== 32) return false;
      const id = Number(proposalId);
      if (!Number.isFinite(id) || id < 0) return false;
      try {
        const nf = computeVoteNullifier(voterSecret, id);
        return nullifiersRef.current.has(bytes32ToLowerHex(nf));
      } catch {
        return false;
      }
    },
    [voterSecret, nullifierEpoch],
  );

  const castVote = useCallback(
    async (
      proposalId: number,
      voteYes: boolean,
      onStage?: (stage: VoteTxStage) => void,
    ) => {
      setError(null);
      if (!connectedApi) {
        onStage?.('failed');
        throw new Error('Wallet not connected');
      }
      try {
        await assertMinGovernanceBalance(connectedApi);
      } catch (e: unknown) {
        const kind = classifyVoteFailure(e);
        if (kind === 'insufficient_balance') onStage?.('failed_insufficient_balance');
        else onStage?.('failed');
        const msg = e instanceof Error ? e.message : 'Balance check failed';
        setError(msg);
        throw e;
      }
      if (!voterSecret || voterSecret.length !== 32) {
        onStage?.('failed');
        throw new Error('Voter identity not ready — wait for local identity to load.');
      }
      setIsVoting(true);
      try {
        onStage?.('preparing');
        const providers = providersRef.current ?? (await createShadowVoteProviders(connectedApi));
        providersRef.current = providers;

        onStage?.('proving');
        const compiledContract = await loadCompiledShadowVoteContract(voterSecret);

        const found = await findDeployedContract(providers as never, {
          compiledContract: compiledContract as never,
          contractAddress: SHADOWVOTE_ADDRESS,
          privateStateId: SHADOWVOTE_PRIVATE_STATE_ID,
          initialPrivateState: {},
        });

        onStage?.('submitting');
        await found.callTx.vote(BigInt(proposalId));
        persistVoteChoice(proposalId, voteYes);
        onStage?.('confirmed');
        await fetchProposals();
      } catch (e: unknown) {
        const kind = classifyVoteFailure(e);
        if (kind === 'user_rejected') onStage?.('failed_user_rejected');
        else if (kind === 'already_voted') onStage?.('failed_already_voted');
        else if (kind === 'insufficient_balance') onStage?.('failed_insufficient_balance');
        else if (kind === 'network') onStage?.('failed_network');
        else onStage?.('failed');
        const msg = e instanceof Error ? e.message : 'Vote failed';
        setError(msg);
        throw e;
      } finally {
        setIsVoting(false);
      }
    },
    [connectedApi, voterSecret, fetchProposals],
  );

  return {
    proposals,
    allProposals,
    fetchGlobalProposals,
    allPastProposals,
    registerPendingProposal,
    fetchProposals,
    castVote,
    checkHasVoted,
    isLoadingProposals,
    isVoting,
    error,
    syncError,
    clearError: () => setError(null),
    clearSyncError: () => setSyncError(null),
  };
}
