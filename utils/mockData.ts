/**
 * Historical / concluded proposal rows for the dashboard "Past Proposals" ledger (Phase 7).
 */

export type PastProposalRecord = {
  id: string;
  title: string;
  description: string;
  /** Yes share 0–100 (display / progress bar). */
  yesVotes: number;
  /** No share 0–100. */
  noVotes: number;
  /** Human-readable turnout, e.g. "3.29M". */
  totalVotes: string;
  status: string;
  imageUrl: string;
};

/** Local banners under `public/past-proposals/` (bundled assets, no remote fetch). */
const USER_HISTORY_IMAGES = [
  '/past-proposals/card-strategic-finance.png',
  '/past-proposals/card-tge-professional.png',
  '/past-proposals/card-protocol-treasury.png',
] as const;

function pickUserHistoryImage(seed: number): string {
  const idx = Math.abs(seed) % USER_HISTORY_IMAGES.length;
  return USER_HISTORY_IMAGES[idx]!;
}

/**
 * After the user submits {@link CreateProposalModal}, we append a finished-style row (mock stats) for Phase 7 UX.
 */
export function createUserPastProposalSnapshot(proposalId: number, title: string): PastProposalRecord {
  const label = title.trim() || `Proposal #${proposalId}`;
  const yesVotes = 68 + (proposalId % 15);
  const noVotes = 100 - yesVotes;
  return {
    id: `user-finished-${proposalId}-${Date.now()}`,
    title: label,
    description:
      'Recorded from your dashboard. Mock results for development — on-chain ShadowVote tallies appear under Active Proposals.',
    yesVotes,
    noVotes,
    totalVotes: proposalId % 3 === 0 ? '12.4K' : proposalId % 3 === 1 ? '892K' : '3.29M',
    status: 'Proposal Passed',
    imageUrl: pickUserHistoryImage(proposalId),
  };
}

export const MOCK_PAST_PROPOSALS: PastProposalRecord[] = [
  {
    id: 'mock-bot-10',
    title: 'BOT-10: Strategic Allocation',
    description:
      'Treasury diversification across core ecosystem partners with milestone-based unlocks and mandatory public reporting.',
    yesVotes: 72,
    noVotes: 28,
    totalVotes: '3.29M',
    status: 'Proposal Passed',
    imageUrl: '/past-proposals/card-strategic-finance.png',
  },
  {
    id: 'mock-xmq-04',
    title: 'XMQ-04: DEUS TGE Window',
    description:
      'Community vote on the token generation event schedule, liquidity seeding parameters, and post-TGE governance handoff.',
    yesVotes: 61,
    noVotes: 39,
    totalVotes: '1.87M',
    status: 'Quorum Reached',
    imageUrl: '/past-proposals/card-tge-professional.png',
  },
  {
    id: 'mock-xmq-03',
    title: 'XMQ-03: RCM Protocol Development',
    description:
      'Fund continued R&D for recursive composition modules, security audits, and testnet hardening ahead of mainnet parity.',
    yesVotes: 84,
    noVotes: 16,
    totalVotes: '4.12M',
    status: 'Proposal Passed',
    imageUrl: '/past-proposals/card-protocol-treasury.png',
  },
];
