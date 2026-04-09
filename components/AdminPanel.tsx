'use client';

import { Button } from '@/components/Button';
import { Body, H2 } from '@/components/Typography';
import { useToast } from '@/contexts/ToastContext';
import { useMidnightWallet } from '@/hooks/useMidnightWallet';
import { type VoteTxStage } from '@/hooks/useShadowVote';
import { keyframes, styled } from '@/stitches.config';
import { useCallback } from 'react';

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

const Card = styled('section', {
  marginTop: '$8',
  padding: '$5',
  borderRadius: '$lg',
  border: '1px solid $gray200',
  backgroundColor: '$gray50',
  boxShadow: '$soft',
});

const HeaderRow = styled('div', {
  marginBottom: '$4',
});

const Spinner = styled('span', {
  display: 'inline-block',
  width: '18px',
  height: '18px',
  border: '2px solid rgba(255,255,255,0.45)',
  borderTopColor: 'rgba(255,255,255,0.95)',
  borderRadius: '50%',
  animation: `${spin} 0.7s linear infinite`,
  flexShrink: 0,
});

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

function applyRegistrySyncToast(
  toast: ReturnType<typeof useToast>,
  toastId: string,
  stage: VoteTxStage,
) {
  switch (stage) {
    case 'preparing':
      toast.update(toastId, {
        variant: 'loading',
        title: 'Collecting leaves',
        message: 'Loading registry and building Merkle root…',
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
        message: 'Signing and sending via Lace.',
      });
      break;
    case 'confirmed':
      toast.update(toastId, {
        variant: 'success',
        title: 'Registry Synced!',
        message: 'New voters are now eligible to vote.',
      });
      break;
    case 'failed_insufficient_balance':
      toast.update(toastId, {
        variant: 'error',
        title: 'Insufficient tNIGHT',
        message: 'Fund unshielded balance for transaction fees.',
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
        title: 'Sync failed',
        message: 'See the error message on the dashboard.',
      });
      break;
    default:
      break;
  }
}

export type AdminPanelProps = {
  syncVoterRegistry: (
    adminPreimage32: Uint8Array,
    onStage?: (stage: VoteTxStage) => void,
  ) => Promise<void>;
  isSyncingRegistry: boolean;
};

export function AdminPanel({ syncVoterRegistry, isSyncingRegistry }: AdminPanelProps) {
  const wallet = useMidnightWallet();
  const toast = useToast();

  const adminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS?.trim() ?? '';
  const connected = wallet.unshieldedAddress?.trim() ?? '';

  if (!adminWallet || !connected || adminWallet.toLowerCase() !== connected.toLowerCase()) {
    return null;
  }

  const onSync = useCallback(async () => {
    const hex =
      typeof window !== 'undefined'
        ? window.prompt('Admin preimage (64 hex chars) for on-chain credential', '')
        : null;
    if (!hex) return;
    let preimage: Uint8Array;
    try {
      preimage = parseAdminPreimageHex(hex);
    } catch (e: unknown) {
      toast.error('Invalid preimage', e instanceof Error ? e.message : 'Invalid input');
      return;
    }
    const toastId = toast.loading('Collecting leaves', 'Preparing registry sync…');
    try {
      await syncVoterRegistry(preimage, (stage) => applyRegistrySyncToast(toast, toastId, stage));
    } catch {
      /* Error surfaced via toast stages and hook error state */
    }
  }, [syncVoterRegistry, toast]);

  return (
    <Card aria-labelledby="admin-controls-heading">
      <HeaderRow>
        <H2 id="admin-controls-heading" css={{ margin: 0, fontSize: '$xl', fontFamily: '$poppins' }}>
          Admin Controls
        </H2>
        <Body
          css={{
            margin: '$2 0 0 0',
            fontSize: '$sm',
            color: '$gray600',
            fontFamily: '$poppins',
          }}
        >
          Push the merged voter Merkle root (Supabase + local registry + admin leaf) to Midnight via{' '}
          <code>update_voter_root</code>.
        </Body>
      </HeaderRow>
      <Button type="button" variant="primary" disabled={!wallet.isConnected || isSyncingRegistry} onClick={() => void onSync()}>
        {isSyncingRegistry ? (
          <>
            <Spinner aria-hidden />
            Syncing…
          </>
        ) : (
          'Sync Voter Registry to Midnight'
        )}
      </Button>
    </Card>
  );
}
