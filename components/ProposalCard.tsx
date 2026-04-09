'use client';

import { Body, Caption } from '@/components/Typography';
import { useToast } from '@/contexts/ToastContext';
import { gradientPrimary, styled } from '@/stitches.config';
import { motion } from 'framer-motion';
import Link from 'next/link';

const Card = styled(motion.article, {
  position: 'relative',
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

const TopBar = styled('div', {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '$3',
});

const ShareButton = styled('button', {
  all: 'unset',
  boxSizing: 'border-box',
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  borderRadius: '$md',
  border: '1px solid #E5E7EB',
  backgroundColor: '#FFFFFF',
  cursor: 'pointer',
  color: '$gray600',
  transition: 'border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease',
  '&:hover': {
    borderColor: '$gray400',
    color: '$black',
    backgroundColor: '$gray50',
  },
  '&:focus-visible': {
    outline: 'none',
    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
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

function ShareGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M10 13a5 5 0 00-1.07 9.9M14 11a5 5 0 011.07-9.9M8.59 13.34l6.83 3.98m.01-7.64L8.58 10.66"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  const toast = useToast();

  const copyShareLink = () => {
    const url = `${window.location.origin}/dashboard/${proposalId}`;
    void navigator.clipboard.writeText(url).then(
      () => {
        toast.success('Link copied to clipboard!');
      },
      () => {
        toast.error('Could not copy link');
      },
    );
  };

  return (
    <Card
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <TopBar>
        <Row css={{ flex: 1, minWidth: 0 }}>
          <ProposalLabel>Proposal #{proposalId}</ProposalLabel>
          <Caption>Votes</Caption>
        </Row>
        <ShareButton type="button" onClick={copyShareLink} aria-label="Copy link to this proposal">
          <ShareGlyph />
        </ShareButton>
      </TopBar>
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
