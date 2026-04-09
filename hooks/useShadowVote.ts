'use client';

import { findDeployedContract, getPublicStates } from '@midnight-ntwrk/midnight-js-contracts';
import type { ContractState, StateValue } from '@midnight-ntwrk/compact-runtime';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Subscription } from 'rxjs';
import { createShadowVoteProviders, type ShadowVoteCircuitId } from '@/lib/createShadowVoteProviders';
import { getAuthorizedVoterLeaves } from '@/lib/voterRegistry';
import { loadCompiledShadowVoteContract } from '@/lib/loadCompiledShadowVote';
import { SHADOWVOTE_ADDRESS, SHADOWVOTE_PRIVATE_STATE_ID } from '@/src/config/contracts';
import { classifyVoteFailure, computeVoteNullifier, bytes32ToLowerHex } from '../utils/crypto';
import {
  buildMerklePathWitness,
  bytesEqual,
  computeVoterLeafHash,
} from '../utils/merkle';

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
  | 'failed_network';

type ContractMod = typeof import('@shadowvote/contract');

function proposalsFromLedger(ledgerView: ReturnType<ContractMod['ledger']>): ProposalView[] {
  const out: ProposalView[] = [];
  for (const [id, tally] of ledgerView.proposals) {
    out.push({ id: Number(id), tally: Number(tally) });
  }
  out.sort((a, b) => a.id - b.id);
  return out;
}

function nullifierSetFromLedger(ledgerView: ReturnType<ContractMod['ledger']>): Set<string> {
  const set = new Set<string>();
  for (const n of ledgerView.nullifiers) {
    set.add(bytes32ToLowerHex(n));
  }
  return set;
}

async function ledgerFromContractState(contractState: ContractState): Promise<{
  proposals: ProposalView[];
  nullifiers: Set<string>;
}> {
  const mod: ContractMod = await import('@shadowvote/contract');
  const ledgerView = mod.ledger(contractState as unknown as StateValue);
  return {
    proposals: proposalsFromLedger(ledgerView),
    nullifiers: nullifierSetFromLedger(ledgerView),
  };
}

/**
 * @param voterSecret - 32-byte persistent secret from {@link useVoterIdentity}; required for witness injection.
 */
export function useShadowVote(connectedApi: ConnectedAPI | null, voterSecret: Uint8Array | null) {
  const [proposals, setProposals] = useState<ProposalView[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  /** Bumps when on-chain nullifier set updates (drives `checkHasVoted` re-renders). */
  const [nullifierEpoch, setNullifierEpoch] = useState(0);
  const nullifiersRef = useRef<Set<string>>(new Set());
  const providersRef = useRef<Awaited<ReturnType<typeof createShadowVoteProviders>> | null>(null);

  const applyContractState = useCallback(async (contractState: ContractState) => {
    const { proposals: next, nullifiers: nextNulls } = await ledgerFromContractState(contractState);
    setProposals(next);
    nullifiersRef.current = nextNulls;
    setNullifierEpoch((e) => e + 1);
    setSyncError(null);
  }, []);

  useEffect(() => {
    providersRef.current = null;
    if (!connectedApi) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await createShadowVoteProviders(connectedApi);
        if (!cancelled) providersRef.current = p;
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to initialize Midnight providers');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connectedApi]);

  /** Live indexer sync: WebSocket stream + 12s polling fallback. */
  useEffect(() => {
    if (!connectedApi) {
      setIsLoadingProposals(false);
      return;
    }
    /** True until first pull finishes — avoids flashing “empty” while providers/indexer initialize. */
    setIsLoadingProposals(true);
    let sub: Subscription | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const run = async () => {
      try {
        const p = providersRef.current ?? (await createShadowVoteProviders(connectedApi));
        if (cancelled) return;
        providersRef.current = p;

        const pull = async () => {
          try {
            const states = await getPublicStates(p.publicDataProvider, SHADOWVOTE_ADDRESS);
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

        sub = p.publicDataProvider
          .contractStateObservable(SHADOWVOTE_ADDRESS, { type: 'latest' })
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
      sub?.unsubscribe();
      if (interval !== undefined) clearInterval(interval);
    };
  }, [connectedApi, applyContractState]);

  const fetchProposals = useCallback(async (): Promise<ProposalView[]> => {
    setError(null);
    if (!connectedApi) {
      setProposals([]);
      nullifiersRef.current = new Set();
      setNullifierEpoch((e) => e + 1);
      return [];
    }
    const providers = providersRef.current ?? (await createShadowVoteProviders(connectedApi));
    providersRef.current = providers;
    setIsLoadingProposals(true);
    try {
      const states = await getPublicStates(providers.publicDataProvider, SHADOWVOTE_ADDRESS);
      await applyContractState(states.contractState);
      const mod: ContractMod = await import('@shadowvote/contract');
      const ledgerView = mod.ledger(states.contractState as unknown as StateValue);
      return proposalsFromLedger(ledgerView);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load proposals';
      setError(msg);
      throw e;
    } finally {
      setIsLoadingProposals(false);
    }
  }, [connectedApi, applyContractState]);

  /**
   * Whether the current voter's nullifier is already in public state for this `proposalId`.
   * Reflects the latest synced ledger (RxJS + polling). Requires `voterSecret`.
   */
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
    async (proposalId: number, onStage?: (stage: VoteTxStage) => void) => {
      setError(null);
      if (!connectedApi) {
        onStage?.('failed');
        throw new Error('Wallet not connected');
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

        const registryLeaves = getAuthorizedVoterLeaves();
        const myLeaf = computeVoterLeafHash(voterSecret);
        const inRegistry = registryLeaves.some((L) => bytesEqual(L, myLeaf));
        if (!inRegistry) {
          throw new Error(
            'Your voter leaf is not in NEXT_PUBLIC_VOTER_REGISTRY_LEAVES_HEX (or the dev default registry).',
          );
        }
        const membershipPath = buildMerklePathWitness(myLeaf, registryLeaves);

        onStage?.('proving');
        const compiledContract = await loadCompiledShadowVoteContract(voterSecret, membershipPath);

        const found = await findDeployedContract(providers as never, {
          compiledContract: compiledContract as never,
          contractAddress: SHADOWVOTE_ADDRESS,
          privateStateId: SHADOWVOTE_PRIVATE_STATE_ID,
          initialPrivateState: {},
        });

        onStage?.('submitting');
        await found.callTx.vote(BigInt(proposalId));
        onStage?.('confirmed');
        await fetchProposals();
      } catch (e: unknown) {
        const kind = classifyVoteFailure(e);
        if (kind === 'user_rejected') onStage?.('failed_user_rejected');
        else if (kind === 'already_voted') onStage?.('failed_already_voted');
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
