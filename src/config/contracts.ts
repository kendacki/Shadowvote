/**
 * ShadowVote deployment configuration.
 * Set `NEXT_PUBLIC_SHADOWVOTE_CONTRACT_ADDRESS` in `.env` (never commit real `.env` files).
 */
const addr = process.env.NEXT_PUBLIC_SHADOWVOTE_CONTRACT_ADDRESS?.trim() ?? '';

if (!addr && typeof window !== 'undefined') {
  console.warn(
    '[ShadowVote] NEXT_PUBLIC_SHADOWVOTE_CONTRACT_ADDRESS is empty — dashboard calls will fail until you set it.',
  );
}

export const SHADOWVOTE_ADDRESS: string = addr;

/** Must match `privateStateId` used at deploy time (`scripts/deploy.ts`). */
export const SHADOWVOTE_PRIVATE_STATE_ID = 'shadowvote-state' as const;
