import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

/** Minimum unshielded tNIGHT (wallet balances) required for governance actions. */
export const GOVERNANCE_MIN_TNIGHT: bigint = BigInt(
  process.env.NEXT_PUBLIC_SHADOWVOTE_MIN_TNIGHT?.trim() || '1000',
);

export function sumUnshieldedBalances(balances: Record<string, bigint>): bigint {
  const preferred = process.env.NEXT_PUBLIC_NIGHT_TOKEN_KEY;
  if (preferred && balances[preferred] !== undefined) return balances[preferred];
  return Object.values(balances).reduce((a, b) => a + b, 0n);
}

export async function readUnshieldedTNightBalance(api: ConnectedAPI): Promise<bigint> {
  const balances = await api.getUnshieldedBalances();
  return sumUnshieldedBalances(balances);
}

const INSUFFICIENT_MSG = (min: bigint) =>
  `Insufficient funds. You need at least ${min.toString()} tNIGHT to participate in governance.`;

export async function assertMinGovernanceBalance(api: ConnectedAPI): Promise<void> {
  const bal = await readUnshieldedTNightBalance(api);
  if (bal < GOVERNANCE_MIN_TNIGHT) {
    throw new Error(INSUFFICIENT_MSG(GOVERNANCE_MIN_TNIGHT));
  }
}

export function isInsufficientGovernanceError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.message.startsWith('Insufficient funds. You need at least ');
}
