'use client';

import { findDeployedContract, getPublicStates } from '@midnight-ntwrk/midnight-js-contracts';
import type { ChargedState, ContractState, StateValue } from '@midnight-ntwrk/compact-runtime';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Subscription } from 'rxjs';
import {
  createShadowVoteProviders,
  createShadowVotePublicDataProvider,
} from '@/lib/createShadowVoteProviders';
import {
  collectLeavesForRegisteredVotersRootSync,
  fetchLeavesFromRegisteredVotersTable,
  isWalletRegisteredForEpoch,
} from '@/lib/voterLeavesSync';
import { getAuthorizedVoterLeaves } from '@/lib/voterRegistry';
import { loadCompiledShadowVoteContract } from '@/lib/loadCompiledShadowVote';
import { loadCompiledShadowVoteAdminContract } from '@/lib/loadCompiledShadowVoteAdmin';
import { SHADOWVOTE_ADDRESS, SHADOWVOTE_PRIVATE_STATE_ID } from '@/src/config/contracts';
import { MOCK_PAST_PROPOSALS } from '@/utils/mockData';
import { supabase } from '@/utils/supabase';
import { assertMinGovernanceBalance } from '@/utils/tNightGate';
import { classifyVoteFailure, computeVoteNullifier, bytes32ToLowerHex } from '../utils/crypto';
import {
  buildMerklePathWitness,
  bytesEqual,
  computeVoterLeafHash,
  computeVoterRegistryRootField,
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
  | 'failed_insufficient_balance'
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

/** Stable fingerprint of public ledger view — skip React updates when the indexer repeats the same snapshot. */
function ledgerSnapshotDigest(
  proposals: ProposalView[],
  nullifiers: Set<string>,
  rootField: bigint | null,
): string {
  const p = proposals.map((x) => `${x.id}:${x.tally}`).join('\u001f');
  const n = [...nullifiers].sort().join('\u001f');
  const r = rootField === null ? '' : String(rootField);
  return `${p}\u001e${n}\u001e${r}`;
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

/**
 * `getPublicStates` returns on-chain-runtime {@link ContractState}; `@shadowvote/contract` `ledger()` expects
 * {@link StateValue} or {@link ChargedState} (it reads `.state` only on the latter — `ContractState` uses `.data`).
 */
function contractStateArgForLedgerView(state: ContractState): ChargedState | StateValue {
  const withData = state as ContractState & { data?: ChargedState };
  if (withData.data != null) {
    return withData.data;
  }
  return state as unknown as ChargedState;
}

async function ledgerFromContractState(contractState: ContractState): Promise<{
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

async function readChainVoterRootField(contractState: ContractState): Promise<bigint | null> {
  try {
    const mod: ContractMod = await import('@shadowvote/contract');
    const ledgerView = mod.ledger(contractStateArgForLedgerView(contractState) as unknown as StateValue);
    return ledgerView.voterRoot.field;
  } catch {
    return null;
  }
}

/** Optional wallet surface for epoch / Supabase gating (e.g. unshielded bech32). */
export type ShadowVoteWalletContext = {
  unshieldedAddress: string | null;
};

/**
 * @param voterSecret - 32-byte persistent secret from {@link useVoterIdentity}; required for witness injection.
 * @param walletCtx - When set, enables Supabase epoch sync and “awaiting admin” gating for registered voters.
 */
export function useShadowVote(
  connectedApi: ConnectedAPI | null,
  voterSecret: Uint8Array | null,
  walletCtx?: ShadowVoteWalletContext | null,
) {
  /** Ledger-derived proposals only (map entries). */
  const [chainProposals, setChainProposals] = useState<ProposalView[]>([]);
  /** User-added ids before the first on-chain vote materializes in public state. */
  const [pendingProposalIds, setPendingProposalIds] = useState<number[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isSyncingRegistry, setIsSyncingRegistry] = useState(false);
  const [chainVoterRootField, setChainVoterRootField] = useState<bigint | null>(null);
  /** False when rebuilt Supabase Merkle root differs from on-chain `voterRoot`. */
  const [isEpochSynced, setIsEpochSynced] = useState(true);
  /**
   * True when this wallet is in `registered_voters`, the epoch is not synced on-chain,
   * and the user is not covered by the legacy `voter-registry.json` tree that still matches the chain.
   */
  const [isAwaitingAdminEpochSync, setIsAwaitingAdminEpochSync] = useState(false);
  const [epochSyncLoading, setEpochSyncLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  /** Bumps when on-chain nullifier set updates (drives `checkHasVoted` re-renders). */
  const [nullifierEpoch, setNullifierEpoch] = useState(0);
  const nullifiersRef = useRef<Set<string>>(new Set());
  const providersRef = useRef<Awaited<ReturnType<typeof createShadowVoteProviders>> | null>(null);
  const chainProposalsRef = useRef<ProposalView[]>([]);
  /** Invalidate in-flight `applyContractState` work after reconnect / unmount; drop stale async results. */
  const applyLedgerGenerationRef = useRef(0);
  /** Last applied public snapshot — avoid re-rendering on duplicate indexer emissions. */
  const lastLedgerDigestRef = useRef<string | null>(null);
  /** Ref mirrors for epoch sync — avoids unstable `useCallback` deps that retrigger effects every render. */
  const connectedApiRef = useRef<ConnectedAPI | null>(connectedApi);
  const chainVoterRootFieldRef = useRef<bigint | null>(chainVoterRootField);
  const voterSecretRef = useRef<Uint8Array | null>(voterSecret);
  const unshieldedAddressRef = useRef<string>(walletCtx?.unshieldedAddress?.trim() ?? '');
  connectedApiRef.current = connectedApi;
  chainVoterRootFieldRef.current = chainVoterRootField;
  voterSecretRef.current = voterSecret;
  unshieldedAddressRef.current = walletCtx?.unshieldedAddress?.trim() ?? '';

  const voterSecretFingerprint = useMemo(() => {
    if (!voterSecret || voterSecret.length !== 32) return '';
    return bytes32ToLowerHex(voterSecret);
  }, [voterSecret]);
  const chainRootKey = chainVoterRootField === null ? null : String(chainVoterRootField);
  const unshieldedAddressKey = walletCtx?.unshieldedAddress?.trim() ?? '';

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

  /** Simulated off-chain index (e.g. Supabase) merged into the active set — extend when wired. */
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
      setChainVoterRootField(null);
      setIsEpochSynced(true);
      setIsAwaitingAdminEpochSync(false);
      setEpochSyncLoading(false);
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

  /** Active proposals: on-chain + pending + global off-chain overlay (same id merges by max tally). */
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

  /** Static mock cards only; dashboard merges Supabase `Ended` / `Passed` rows separately. */
  const allPastProposals = useMemo(() => [...MOCK_PAST_PROPOSALS], []);

  const applyContractState = useCallback(async (contractState: ContractState) => {
    const gen = ++applyLedgerGenerationRef.current;
    const { proposals: next, nullifiers: nextNulls } = await ledgerFromContractState(contractState);
    const rootField = await readChainVoterRootField(contractState);
    if (gen !== applyLedgerGenerationRef.current) return;

    setSyncError(null);

    const digest = ledgerSnapshotDigest(next, nextNulls, rootField);
    if (digest === lastLedgerDigestRef.current) {
      return;
    }
    lastLedgerDigestRef.current = digest;

    setChainProposals(next);
    nullifiersRef.current = nextNulls;
    setChainVoterRootField(rootField);
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

  const checkEpochSync = useCallback(async () => {
    const api = connectedApiRef.current;
    const chainRoot = chainVoterRootFieldRef.current;
    const vs = voterSecretRef.current;
    const addr = unshieldedAddressRef.current;

    if (!api || chainRoot === null) {
      return;
    }
    if (!supabase) {
      setIsEpochSynced(true);
      setIsAwaitingAdminEpochSync(false);
      return;
    }
    setEpochSyncLoading(true);
    try {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });
      const leavesMerged = await collectLeavesForRegisteredVotersRootSync(null);
      const rootMerged = computeVoterRegistryRootField(leavesMerged);
      let dbOnlyRoot: bigint | null = null;
      try {
        const dbLeaves = await fetchLeavesFromRegisteredVotersTable();
        if (dbLeaves.length > 0) {
          dbOnlyRoot = computeVoterRegistryRootField(dbLeaves);
        }
      } catch {
        dbOnlyRoot = null;
      }
      const synced = rootMerged === chainRoot || (dbOnlyRoot !== null && dbOnlyRoot === chainRoot);
      setIsEpochSynced(synced);

      let inSupabase = false;
      if (addr) {
        inSupabase = await isWalletRegisteredForEpoch(addr);
      }

      let legacyJsonMatchesChain = false;
      if (vs != null && vs.length === 32) {
        try {
          const jsonLeaves = getAuthorizedVoterLeaves();
          const jsonRoot = computeVoterRegistryRootField(jsonLeaves);
          if (jsonRoot === chainRoot) {
            const myLeaf = computeVoterLeafHash(vs);
            buildMerklePathWitness(myLeaf, jsonLeaves);
            legacyJsonMatchesChain = true;
          }
        } catch {
          legacyJsonMatchesChain = false;
        }
      }

      const awaiting = !synced && inSupabase && !legacyJsonMatchesChain;
      setIsAwaitingAdminEpochSync(awaiting);
    } catch (e: unknown) {
      console.warn('[ShadowVote] checkEpochSync failed', e);
      setIsEpochSynced(true);
      setIsAwaitingAdminEpochSync(false);
    } finally {
      setEpochSyncLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!connectedApi || chainRootKey === null) {
      return;
    }
    let cancelled = false;
    void (async () => {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });
      if (cancelled) return;
      try {
        await checkEpochSync();
      } catch (e: unknown) {
        console.warn('[ShadowVote] scheduled checkEpochSync rejected', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connectedApi, chainRootKey, unshieldedAddressKey, voterSecretFingerprint, checkEpochSync]);

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

        const registryLeaves = getAuthorizedVoterLeaves();
        const myLeaf = computeVoterLeafHash(voterSecret);
        const inRegistry = registryLeaves.some((L) => bytesEqual(L, myLeaf));
        if (!inRegistry) {
          console.log(
            'CURRENT VOTER LEAF — add to config/voter-registry.json `leaves`, then redeploy or admin sync root:',
            `0x${bytes32ToLowerHex(myLeaf)}`,
          );
          throw new Error(
            'Your voter leaf is not in config/voter-registry.json — add the hex above to `leaves`, then redeploy or update the on-chain root (admin).',
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

  /**
   * Submit `update_voter_root` with an already computed Merkle root field (mutable Compact circuit).
   */
  const submitUpdateVoterRoot = useCallback(
    async (
      rootField: bigint,
      adminPreimage32: Uint8Array,
      onStage: ((stage: VoteTxStage) => void) | undefined,
      loadingMode: 'vote' | 'sync',
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
        throw e;
      }
      if (loadingMode === 'vote') setIsVoting(true);
      else setIsSyncingRegistry(true);
      try {
        onStage?.('preparing');
        const providers = providersRef.current ?? (await createShadowVoteProviders(connectedApi));
        providersRef.current = providers;
        const compiled = await loadCompiledShadowVoteAdminContract(adminPreimage32);
        onStage?.('proving');
        const found = await findDeployedContract(providers as never, {
          compiledContract: compiled as never,
          contractAddress: SHADOWVOTE_ADDRESS,
          privateStateId: SHADOWVOTE_PRIVATE_STATE_ID,
          initialPrivateState: {},
        });
        const callTx = found.callTx as typeof found.callTx & {
          update_voter_root?: (digest: { field: bigint }) => Promise<unknown>;
        };
        if (typeof callTx.update_voter_root !== 'function') {
          throw new Error(
            'This deployment uses an older ShadowVote contract — run npm run compile:contract, deploy again, and sync ZK artifacts (zk:public).',
          );
        }
        onStage?.('submitting');
        await callTx.update_voter_root({ field: rootField });
        onStage?.('confirmed');
        await fetchProposals();
      } catch (e: unknown) {
        const kind = classifyVoteFailure(e);
        if (kind === 'user_rejected') onStage?.('failed_user_rejected');
        else if (kind === 'insufficient_balance') onStage?.('failed_insufficient_balance');
        else if (kind === 'network') onStage?.('failed_network');
        else onStage?.('failed');
        setError(e instanceof Error ? e.message : 'update_voter_root failed');
        throw e;
      } finally {
        if (loadingMode === 'vote') setIsVoting(false);
        else setIsSyncingRegistry(false);
      }
    },
    [connectedApi, fetchProposals],
  );

  const updateVoterRootFromRegistry = useCallback(
    async (adminPreimage32: Uint8Array, onStage?: (stage: VoteTxStage) => void) => {
      const leaves = getAuthorizedVoterLeaves();
      const rootField = computeVoterRegistryRootField(leaves);
      await submitUpdateVoterRoot(rootField, adminPreimage32, onStage, 'vote');
    },
    [submitUpdateVoterRoot],
  );

  /**
   * Builds the Merkle root from Supabase `registered_voters.voter_leaf` (plus admin fallback leaf),
   * then calls `update_voter_root` on-chain.
   */
  const syncVoterRegistry = useCallback(
    async (adminPreimage32: Uint8Array, onStage?: (stage: VoteTxStage) => void) => {
      onStage?.('preparing');
      const adminLeaf =
        voterSecret && voterSecret.length === 32 ? computeVoterLeafHash(voterSecret) : null;
      const leaves = await collectLeavesForRegisteredVotersRootSync(adminLeaf);
      if (leaves.length === 0) {
        const msg =
          'No voter leaves in registered_voters — register voters from the dashboard or insert rows in Supabase.';
        setError(msg);
        onStage?.('failed');
        throw new Error(msg);
      }
      const newRoot = computeVoterRegistryRootField(leaves);
      await submitUpdateVoterRoot(newRoot, adminPreimage32, onStage, 'sync');
    },
    [submitUpdateVoterRoot, voterSecret],
  );

  return {
    proposals,
    allProposals,
    fetchGlobalProposals,
    allPastProposals,
    registerPendingProposal,
    fetchProposals,
    castVote,
    updateVoterRootFromRegistry,
    syncVoterRegistry,
    checkHasVoted,
    isLoadingProposals,
    isVoting,
    isSyncingRegistry,
    isEpochSynced,
    isAwaitingAdminEpochSync,
    epochSyncLoading,
    checkEpochSync,
    error,
    syncError,
    clearError: () => setError(null),
    clearSyncError: () => setSyncError(null),
  };
}
