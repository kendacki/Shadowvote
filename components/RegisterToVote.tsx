'use client';

import { Button } from '@/components/Button';
import { useToast } from '@/contexts/ToastContext';
import { useMidnightWallet } from '@/hooks/useMidnightWallet';
import { useVoterIdentity } from '@/hooks/useVoterIdentity';
import { styled } from '@/stitches.config';
import { supabase } from '@/utils/supabase';
import { bytes32ToLowerHex } from '@/utils/crypto';
import { assertMinGovernanceBalance } from '@/utils/tNightGate';
import { computeVoterLeafHash } from '@/utils/merkle';
import { useCallback, useState } from 'react';

const Wrap = styled('div', {
  display: 'inline-flex',
  alignItems: 'center',
});

function isPostgresUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: string; message?: string };
  if (e.code === '23505') return true;
  const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  return msg.includes('duplicate') || msg.includes('unique');
}

export type RegisterToVoteProps = {
  /** When true, disables the button (e.g. proposal TX or admin sync in flight). */
  syncBusy?: boolean;
};

export function RegisterToVote({ syncBusy = false }: RegisterToVoteProps) {
  const wallet = useMidnightWallet();
  const toast = useToast();
  const api = wallet.isConnected ? wallet.getConnectedApi() : null;
  const identity = useVoterIdentity(api, {
    isWalletConnected: wallet.isConnected,
    tNightBalance: wallet.tNightBalance,
  });
  const [isRegistering, setIsRegistering] = useState(false);

  const handleRegister = useCallback(async () => {
    if (!wallet.isConnected || !wallet.unshieldedAddress) {
      toast.error('Wallet required', 'Connect Lace before registering.');
      return;
    }
    if (!api) {
      toast.error('Wallet required', 'Connector not available.');
      return;
    }
    if (!identity.voterSecret || identity.voterSecret.length !== 32) {
      toast.error('Identity not ready', 'Wait for your local voter credential to load.');
      return;
    }
    if (!supabase) {
      toast.error('Supabase not configured', 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    setIsRegistering(true);
    try {
      try {
        await assertMinGovernanceBalance(api);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Balance check failed';
        toast.error('Insufficient tNIGHT', msg);
        return;
      }

      const leafBytes = computeVoterLeafHash(identity.voterSecret);
      const currentUserLeafHex = bytes32ToLowerHex(leafBytes);
      const connectedAddress = wallet.unshieldedAddress.trim();

      const { error } = await supabase
        .from('registered_voters')
        .insert([{ wallet_address: connectedAddress, voter_leaf: currentUserLeafHex }]);

      if (error) {
        if (isPostgresUniqueViolation(error)) {
          toast.info('Your wallet is already registered!', 'This wallet already has a voter leaf on file.');
          return;
        }
        toast.error('Registration failed', error.message);
        return;
      }

      toast.success(
        'Successfully registered!',
        'Waiting for Admin to sync the epoch.',
      );
    } finally {
      setIsRegistering(false);
    }
  }, [api, identity.voterSecret, toast, wallet.isConnected, wallet.unshieldedAddress]);

  if (!wallet.isConnected || !wallet.unshieldedAddress) {
    return null;
  }

  const canSubmit =
    identity.isReady &&
    identity.voterSecret != null &&
    identity.voterSecret.length === 32 &&
    !identity.blockedByFundThreshold;

  return (
    <Wrap>
      <Button
        type="button"
        variant="secondary"
        disabled={!canSubmit || isRegistering || syncBusy}
        onClick={() => void handleRegister()}
      >
        {isRegistering ? 'Registering…' : 'Register to Vote'}
      </Button>
    </Wrap>
  );
}
