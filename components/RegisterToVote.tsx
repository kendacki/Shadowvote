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
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '$2',
});

const StatusText = styled('span', {
  fontSize: '$sm',
  color: '$gray600',
  maxWidth: 280,
  lineHeight: 1.35,
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

/**
 * Derives the voter leaf hex from the local Lace-linked credential (same as ZK voting inputs).
 */
async function getMidnightWalletLeaf(secret: Uint8Array | null): Promise<string | null> {
  await Promise.resolve();
  if (!secret || secret.length !== 32) return null;
  const leafBytes = computeVoterLeafHash(secret);
  return bytes32ToLowerHex(leafBytes);
}

export function RegisterToVote({ syncBusy = false }: RegisterToVoteProps) {
  const wallet = useMidnightWallet();
  const toast = useToast();
  const api = wallet.isConnected ? wallet.getConnectedApi() : null;
  const identity = useVoterIdentity(api, {
    isWalletConnected: wallet.isConnected,
    tNightBalance: wallet.tNightBalance,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleRegister = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setStatusMessage('Requesting wallet access...');
    console.log('[Register] 1. Starting registration process...');

    try {
      console.log('[Register] 2. Awaiting wallet leaf...');

      if (!wallet.isConnected || !wallet.unshieldedAddress) {
        throw new Error('Connect Lace before registering.');
      }
      if (!api) {
        throw new Error('Connector not available.');
      }
      if (!supabase) {
        throw new Error(
          'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
        );
      }
      if (!identity.isReady) {
        throw new Error('Wait for your local voter credential to load.');
      }
      if (!identity.voterSecret || identity.voterSecret.length !== 32) {
        throw new Error('Could not extract leaf from wallet. Please check your Lace extension.');
      }
      if (identity.blockedByFundThreshold) {
        throw new Error('Insufficient tNIGHT to register. Fund your wallet above the governance minimum.');
      }

      setStatusMessage('Verifying governance balance...');
      console.log('[Register] 2a. Checking tNIGHT / governance balance...');
      await assertMinGovernanceBalance(api);
      console.log('[Register] 2b. Balance check completed.');

      const userLeaf = await getMidnightWalletLeaf(identity.voterSecret);
      if (!userLeaf) {
        throw new Error('Could not extract leaf from wallet. Please check your Lace extension.');
      }
      console.log('[Register] 3. Leaf extracted:', userLeaf);

      const connectedAddress = wallet.unshieldedAddress.trim();

      setStatusMessage('Saving to registry...');
      console.log('[Register] 4. Awaiting Supabase insertion...');

      const { error } = await supabase.from('registered_voters').insert([
        { wallet_address: connectedAddress, voter_leaf: userLeaf },
      ]);

      if (error) {
        if (isPostgresUniqueViolation(error) || error.code === '23505') {
          throw new Error('Your wallet is already registered!');
        }
        throw error;
      }

      console.log('[Register] 5. Registration successful!');
      setStatusMessage('Successfully registered!');
      toast.success('Successfully registered!', 'Waiting for Admin to sync the epoch.');
    } catch (error: unknown) {
      console.error('[Register] ERROR:', error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Registration failed.';
      setStatusMessage(message || 'Registration failed.');
      toast.error('Registration failed', message || 'Registration failed.');
    } finally {
      setIsLoading(false);
      console.log('[Register] 6. Process complete. UI unlocked.');
    }
  }, [
    api,
    identity.blockedByFundThreshold,
    identity.isReady,
    identity.voterSecret,
    isLoading,
    toast,
    wallet.isConnected,
    wallet.unshieldedAddress,
  ]);

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
        disabled={!canSubmit || isLoading || syncBusy}
        onClick={() => void handleRegister()}
      >
        {isLoading ? 'Registering...' : 'Register to Vote'}
      </Button>
      {statusMessage ? <StatusText>{statusMessage}</StatusText> : null}
    </Wrap>
  );
}
