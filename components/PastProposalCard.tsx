'use client';

import { Button } from '@/components/Button';
import { useToast } from '@/contexts/ToastContext';
import { styled } from '@/stitches.config';
import type { PastProposalRecord } from '@/utils/mockData';
import { motion } from 'framer-motion';
import Image from 'next/image';

const Card = styled(motion.article, {
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '16px',
  overflow: 'hidden',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  minHeight: '420px',
});

const ImageWrap = styled('div', {
  position: 'relative',
  width: '100%',
  aspectRatio: '16 / 9',
  flexShrink: 0,
  backgroundColor: '$gray100',
});

const ImageTopActions = styled('div', {
  position: 'absolute',
  top: '$3',
  right: '$3',
  zIndex: 2,
});

const ShareButton = styled('button', {
  all: 'unset',
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  borderRadius: '$md',
  border: '1px solid rgba(255, 255, 255, 0.85)',
  backgroundColor: 'rgba(255, 255, 255, 0.94)',
  cursor: 'pointer',
  color: '$gray600',
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
  transition: 'color 0.15s ease, background-color 0.15s ease',
  '&:hover': {
    color: '$black',
    backgroundColor: '#FFFFFF',
  },
  '&:focus-visible': {
    outline: 'none',
    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.2), 0 4px 12px rgba(15, 23, 42, 0.12)',
  },
});

const CardBody = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  padding: '$5',
  gap: '$4',
});

const TagRow = styled('div', {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '$2',
});

const TagDark = styled('span', {
  fontFamily: '$poppins',
  fontSize: '11px',
  fontWeight: '$semibold',
  padding: '4px 10px',
  borderRadius: '999px',
  backgroundColor: '#1F2937',
  color: '#F9FAFB',
  letterSpacing: '0.02em',
});

const TagGreen = styled('span', {
  fontFamily: '$poppins',
  fontSize: '11px',
  fontWeight: '$semibold',
  padding: '4px 10px',
  borderRadius: '999px',
  backgroundColor: 'rgba(16, 185, 129, 0.14)',
  color: '#047857',
  letterSpacing: '0.02em',
});

const Title = styled('h3', {
  margin: 0,
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$lg',
  lineHeight: 1.3,
  letterSpacing: '-0.02em',
  color: '$black',
});

const Description = styled('p', {
  margin: 0,
  fontFamily: '$poppins',
  fontWeight: '$regular',
  fontSize: '$sm',
  lineHeight: 1.55,
  color: '$gray600',
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

const Track = styled('div', {
  width: '100%',
  height: '10px',
  borderRadius: '999px',
  backgroundColor: '#E5E7EB',
  overflow: 'hidden',
});

const YesFill = styled(motion.div, {
  width: '100%',
  height: '100%',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
  transformOrigin: 'left center',
});

const StatsRow = styled('div', {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '$3',
});

const StatBlock = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '$1',
  minWidth: 0,
});

const StatLabel = styled('span', {
  fontFamily: '$poppins',
  fontWeight: '$regular',
  fontSize: '11px',
  color: '$gray500',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
});

const StatValue = styled('span', {
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$md',
  color: '$black',
});

const Footer = styled('div', {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  marginTop: 'auto',
  paddingTop: '$2',
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

export type PastProposalCardProps = {
  proposal: PastProposalRecord;
  index?: number;
};

export function PastProposalCard({ proposal, index = 0 }: PastProposalCardProps) {
  const toast = useToast();
  const { title, description, yesVotes, noVotes, totalVotes, status, imageUrl } = proposal;

  const copyShareLink = () => {
    const url = `${window.location.origin}/dashboard/${encodeURIComponent(proposal.id)}`;
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
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
    >
      <ImageWrap>
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 360px"
          style={{ objectFit: 'cover' }}
        />
        <ImageTopActions>
          <ShareButton type="button" onClick={copyShareLink} aria-label="Copy link to this proposal">
            <ShareGlyph />
          </ShareButton>
        </ImageTopActions>
      </ImageWrap>
      <CardBody>
        <TagRow>
          <TagDark>Proposal</TagDark>
          <TagGreen>{status}</TagGreen>
        </TagRow>
        <Title>{title}</Title>
        <Description>{description}</Description>
        <Track>
          <YesFill
            initial={{ scaleX: 0 }}
            animate={{ scaleX: yesVotes / 100 }}
            transition={{ duration: 0.85, delay: 0.12 + index * 0.04, ease: [0.22, 1, 0.36, 1] }}
          />
        </Track>
        <StatsRow>
          <StatBlock>
            <StatLabel>Yes votes</StatLabel>
            <StatValue>{yesVotes}%</StatValue>
          </StatBlock>
          <StatBlock>
            <StatLabel>No votes</StatLabel>
            <StatValue>{noVotes}%</StatValue>
          </StatBlock>
          <StatBlock>
            <StatLabel>Total votes</StatLabel>
            <StatValue>{totalVotes}</StatValue>
          </StatBlock>
        </StatsRow>
        <Footer>
          <Button type="button" variant="secondary" disabled aria-disabled="true">
            Ended
          </Button>
        </Footer>
      </CardBody>
    </Card>
  );
}
