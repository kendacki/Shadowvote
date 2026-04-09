'use client';

import { Body, Caption } from '@/components/Typography';
import { gradientPrimary, styled } from '@/stitches.config';
import { motion } from 'framer-motion';
import Link from 'next/link';

const Card = styled(motion.article, {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  padding: '$5',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
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

const ProposalLabel = styled('span', {
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$md',
  color: '$black',
});

const Tally = styled('span', {
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$2xl',
  color: '$black',
  letterSpacing: '-0.02em',
});

const ViewVoteLink = styled(Link, {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 'auto',
  width: '100%',
  padding: '$3 $6',
  borderRadius: '$pill',
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$md',
  color: '$white',
  textDecoration: 'none',
  background: gradientPrimary,
  boxShadow: '$buttonPrimary',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: '0 12px 28px rgba(185, 28, 28, 0.32)',
  },
  '&:active': {
    transform: 'translateY(0)',
  },
});

export type ProposalCardProps = {
  proposalId: number;
  tally: number;
  index?: number;
};

export function ProposalCard({ proposalId, tally, index = 0 }: ProposalCardProps) {
  return (
    <Card
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <Row>
        <ProposalLabel>Proposal #{proposalId}</ProposalLabel>
        <Caption>Votes</Caption>
      </Row>
      <Tally>{tally}</Tally>
      <Body
        css={{
          fontFamily: '$poppins',
          fontWeight: '$regular',
          fontSize: '$sm',
          color: '$gray500',
          margin: 0,
        }}
      >
        Open the proposal to review details and cast an anonymous vote with your wallet.
      </Body>
      <ViewVoteLink href={`/dashboard/${proposalId}`}>View & Vote</ViewVoteLink>
    </Card>
  );
}
