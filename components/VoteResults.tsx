'use client';

import { Body, Caption, FeatureTitle } from '@/components/Typography';
import { gradientPrimary, styled } from '@/stitches.config';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';

const Wrap = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '$5',
  padding: '$6',
  borderRadius: '$lg',
  border: '1px solid $gray200',
  backgroundColor: '$white',
  boxShadow: '$soft',
});

const StatRow = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '$2',
});

const Track = styled('div', {
  position: 'relative',
  height: '14px',
  borderRadius: '$pill',
  backgroundColor: '$gray100',
  overflow: 'hidden',
});

const Fill = styled(motion.div, {
  height: '100%',
  borderRadius: '$pill',
  background: gradientPrimary,
  transformOrigin: 'left center',
  boxShadow: '0 4px 14px rgba(185, 28, 28, 0.28)',
});

const MetaRow = styled('div', {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '$3',
});

const BigFigure = styled('span', {
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$3xl',
  color: '$black',
  letterSpacing: '-0.03em',
  lineHeight: 1.1,
});

export type VoteResultsProps = {
  proposalId: number;
  tally: number;
  /** Sum of tallies across proposals (for share-of-total visualization). */
  totalVotesAllProposals: number;
};

export function VoteResults({ proposalId, tally, totalVotesAllProposals }: VoteResultsProps) {
  const share = totalVotesAllProposals > 0 ? tally / totalVotesAllProposals : 0;
  const pct = Math.min(100, Math.max(0, share * 100));

  const target = useMotionValue(0);
  const spring = useSpring(target, { stiffness: 120, damping: 22, mass: 0.9 });
  const widthPct = useTransform(spring, (v) => `${v}%`);

  useEffect(() => {
    target.set(pct);
  }, [pct, target]);

  return (
    <Wrap>
      <MetaRow>
        <div>
          <Caption>Proposal #{proposalId}</Caption>
          <FeatureTitle css={{ marginTop: '$1', color: '$black' }}>Vote results</FeatureTitle>
        </div>
        <Body css={{ color: '$gray500', fontSize: '$sm' }}>
          Share of all recorded votes on this contract
        </Body>
      </MetaRow>

      <StatRow>
        <BigFigure>{tally}</BigFigure>
        <Caption>Confirmed votes (on-chain tally)</Caption>
        <Track>
          <Fill style={{ width: widthPct }} initial={{ opacity: 0.85 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }} />
        </Track>
        <Body css={{ fontSize: '$sm', color: '$gray500' }}>
          {totalVotesAllProposals > 0 ? (
            <>
              {pct.toFixed(1)}% of {totalVotesAllProposals} total vote{totalVotesAllProposals === 1 ? '' : 's'} across
              proposals
            </>
          ) : (
            <>No votes recorded on this contract yet — cast the first one.</>
          )}
        </Body>
      </StatRow>
    </Wrap>
  );
}
