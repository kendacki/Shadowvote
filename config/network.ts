/**
 * Browser-visible Midnight network tier for UX (banner, copy).
 * Uses `NEXT_PUBLIC_MIDNIGHT_NETWORK` when set; otherwise `NEXT_PUBLIC_MIDNIGHT_NETWORK_ID` (existing app convention).
 */

export type MidnightNetworkEnv = 'local' | 'testnet' | 'preprod' | 'mainnet';

const CANONICAL: Record<string, MidnightNetworkEnv> = {
  local: 'local',
  dev: 'local',
  development: 'local',
  testnet: 'testnet',
  test: 'testnet',
  preview: 'preprod',
  preprod: 'preprod',
  previewnet: 'preprod',
  mainnet: 'mainnet',
  main: 'mainnet',
};

function readRawNetworkId(): string {
  const explicit = process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK?.trim();
  if (explicit) return explicit;
  return (process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK_ID ?? 'preprod').trim();
}

function normalizeNetwork(raw: string): MidnightNetworkEnv {
  const key = raw.toLowerCase();
  const mapped = CANONICAL[key as keyof typeof CANONICAL];
  if (mapped !== undefined) return mapped;
  return 'preprod';
}

/** Resolved environment for this build / request (NEXT_PUBLIC_* inlined at build time on Vercel). */
export const midnightNetworkEnv: MidnightNetworkEnv = normalizeNetwork(readRawNetworkId());

/** Human-readable label for banners and docs. */
export const midnightNetworkLabel: Record<MidnightNetworkEnv, string> = {
  local: 'Local',
  testnet: 'Testnet',
  preprod: 'Preprod',
  mainnet: 'Mainnet',
};

export function getMidnightNetworkDisplayName(env: MidnightNetworkEnv = midnightNetworkEnv): string {
  return midnightNetworkLabel[env];
}

export function isMidnightMainnet(env: MidnightNetworkEnv = midnightNetworkEnv): boolean {
  return env === 'mainnet';
}
