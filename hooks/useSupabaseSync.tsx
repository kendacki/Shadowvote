'use client';

import { supabase } from '@/utils/supabase';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** Row shape for `public.proposals` (waiting room before first on-chain vote). */
export type OffChainProposalRow = {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at?: string;
};

export type PublishProposalInput = {
  /** Off-chain row key; if omitted or blank, a UUID is generated before insert. */
  id?: string;
  title: string;
  description?: string;
  status: string;
};

function rowFromRecord(record: Record<string, unknown>): OffChainProposalRow | null {
  const id = record.id;
  const title = record.title;
  const status = record.status;
  if (typeof id !== 'string' || typeof title !== 'string' || typeof status !== 'string') {
    return null;
  }
  const description = typeof record.description === 'string' ? record.description : undefined;
  const created_at =
    typeof record.created_at === 'string' ? record.created_at : undefined;
  return { id, title, status, ...(description !== undefined ? { description } : {}), ...(created_at ? { created_at } : {}) };
}

function mergeRows(prev: OffChainProposalRow[], next: OffChainProposalRow): OffChainProposalRow[] {
  const i = prev.findIndex((r) => r.id === next.id);
  if (i === -1) return [...prev, next].sort((a, b) => a.id.localeCompare(b.id));
  const copy = [...prev];
  copy[i] = next;
  return copy.sort((a, b) => a.id.localeCompare(b.id));
}

type SupabaseSyncContextValue = {
  offChainProposals: OffChainProposalRow[];
  publishProposal: (proposal: PublishProposalInput) => Promise<void>;
  isConfigured: boolean;
};

const SupabaseSyncContext = createContext<SupabaseSyncContextValue | null>(null);

export function SupabaseSyncProvider({ children }: { children: ReactNode }) {
  const [offChainProposals, setOffChainProposals] = useState<OffChainProposalRow[]>([]);
  const isConfigured = supabase != null;

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let cancelled = false;

    void (async () => {
      const { data, error } = await client.from('proposals').select('*');
      if (cancelled) return;
      if (error) {
        console.error('[ShadowVote] Supabase proposals fetch failed:', error.message);
        return;
      }
      const rows = (Array.isArray(data) ? data : [])
        .map((raw) => rowFromRecord(raw as Record<string, unknown>))
        .filter((r): r is OffChainProposalRow => r != null);
      setOffChainProposals(rows);
    })();

    const channel = client
      .channel('custom-all-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'proposals' },
        (payload: {
          eventType: string;
          new?: Record<string, unknown>;
          old?: Record<string, unknown>;
        }) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const row = rowFromRecord(payload.new as Record<string, unknown>);
            if (row) setOffChainProposals((prev) => mergeRows(prev, row));
            return;
          }
          if (payload.eventType === 'UPDATE' && payload.new) {
            const row = rowFromRecord(payload.new as Record<string, unknown>);
            if (row) setOffChainProposals((prev) => mergeRows(prev, row));
            return;
          }
          if (payload.eventType === 'DELETE' && payload.old) {
            const oldId = payload.old.id;
            if (typeof oldId === 'string') {
              setOffChainProposals((prev) => prev.filter((r) => r.id !== oldId));
            }
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, []);

  const publishProposal = useCallback(async (proposal: PublishProposalInput) => {
    if (!supabase) {
      console.error('[ShadowVote] publishProposal: Supabase client is null (check NEXT_PUBLIC_SUPABASE_* env).');
      throw new Error('Supabase is not configured');
    }

    const id =
      proposal.id != null && String(proposal.id).trim() !== ''
        ? String(proposal.id).trim()
        : crypto.randomUUID();
    const title =
      proposal.title != null && String(proposal.title).trim() !== ''
        ? String(proposal.title).trim()
        : 'Untitled Proposal';
    const description =
      proposal.description != null ? String(proposal.description).trim() : '';
    const status =
      proposal.status != null && String(proposal.status).trim() !== ''
        ? String(proposal.status).trim()
        : 'Pending First Vote';

    const rowPayload = { id, title, description, status };
    console.log('[ShadowVote] publishProposal: attempting insert', rowPayload);

    const { data, error } = await supabase.from('proposals').insert([rowPayload]).select('*').maybeSingle();

    if (error) {
      console.error('[ShadowVote] SUPABASE ERROR (proposals insert):', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        fullError: error,
      });
      throw error;
    }

    console.log('[ShadowVote] publishProposal: insert OK', data);
    const row = data ? rowFromRecord(data as Record<string, unknown>) : null;
    if (row) {
      setOffChainProposals((prev) => mergeRows(prev, row));
    }
  }, []);

  const value = useMemo<SupabaseSyncContextValue>(
    () => ({
      offChainProposals,
      publishProposal,
      isConfigured,
    }),
    [offChainProposals, publishProposal, isConfigured],
  );

  return <SupabaseSyncContext.Provider value={value}>{children}</SupabaseSyncContext.Provider>;
}

export function useSupabaseSync(): SupabaseSyncContextValue {
  const ctx = useContext(SupabaseSyncContext);
  if (!ctx) {
    throw new Error('useSupabaseSync must be used within SupabaseSyncProvider');
  }
  return ctx;
}
