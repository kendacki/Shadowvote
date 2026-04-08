'use client';

import { Button } from '@/components/Button';
import { Body, Caption, FeatureTitle } from '@/components/Typography';
import { gradientPrimary, styled } from '@/stitches.config';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';

const Card = styled(motion.article, {
  backgroundColor: '$white',
  border: '1px solid $gray200',
  borderRadius: '$lg',
  padding: '$5',
  boxShadow: '$soft',
  display: 'flex',
  flexDirection: 'column',
  gap: '$4',
  minHeight: '200px',
});

const Row = styled('div', {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '$3',
});

const Tally = styled('span', {
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$2xl',
  color: '$black',
  letterSpacing: '-0.02em',
});

const DetailLink = styled(Link, {
  fontFamily: '$poppins',
  fontSize: '$sm',
  fontWeight: '$semibold',
  color: '$red400',
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
});

const VoteCastPill = styled(motion.div, {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  padding: '$3 $6',
  borderRadius: '$pill',
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$md',
  color: '$white',
  background: gradientPrimary,
  boxShadow: '$buttonPrimary',
});

export type ProposalCardProps = {
  proposalId: number;
  tally: number;
  onVote: () => void;
  disabled?: boolean;
  isVoting?: boolean;
  index?: number;
  /** When true, replaces the primary button with a success pill (Sybil UX). */
  hasVoted?: boolean;
};

export function ProposalCard({
  proposalId,
  tally,
  onVote,
  disabled,
  isVoting,
  index = 0,
  hasVoted = false,
}: ProposalCardProps) {
  return (
    <Card
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <Row>
        <FeatureTitle>Proposal #{proposalId}</FeatureTitle>
        <Caption>Current votes</Caption>
      </Row>
      <Tally>{tally}</Tally>
      <Body css={{ color: '$gray500', fontSize: '$sm' }}>
        Cast an anonymous vote. Proofs are generated locally via your wallet and the Midnight proof flow.
      </Body>
      <DetailLink href={`/dashboard/${proposalId}`}>View results & analytics →</DetailLink>
      <AnimatePresence mode="wait" initial={false}>
        {hasVoted ? (
          <VoteCastPill
            key="cast"
            role="status"
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            Vote recorded
          </VoteCastPill>
        ) : (
          <motion.div
            key="open"
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%' }}
          >
            <Button type="button" variant="primary" fullWidth disabled={disabled || isVoting} onClick={onVote}>
              {isVoting ? 'Proving & submitting…' : 'Cast Vote'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
