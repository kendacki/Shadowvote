/**
 * ShadowVote deployment configuration.
 * Prefer `NEXT_PUBLIC_SHADOWVOTE_CONTRACT_ADDRESS` in `.env` for your deployment.
 * Fallback is the previous Preprod dev address (public on-chain id, not a wallet secret).
 */
const DEPLOYMENT_ADDRESS_FALLBACK =
  'd07a075a45de0e9d3f5ebe7425a917d2ad38a68939d21f7a5efd7228b3fc5e26';

const addr = (
  process.env.NEXT_PUBLIC_SHADOWVOTE_CONTRACT_ADDRESS?.trim() || DEPLOYMENT_ADDRESS_FALLBACK
).trim();

export const SHADOWVOTE_ADDRESS: string = addr;

/** Must match `privateStateId` used at deploy time (`scripts/deploy.ts`). */
export const SHADOWVOTE_PRIVATE_STATE_ID = 'shadowvote-state' as const;
