'use client';

import { Button } from '@/components/Button';
import { styled } from '@/stitches.config';
import { motion } from 'framer-motion';

const Root = styled(motion.div, {
  maxWidth: '540px',
  margin: '0 auto',
  padding: '$9 $6',
  borderRadius: '$lg',
  border: '1px solid #E5E7EB',
  backgroundColor: '#FFFFFF',
  textAlign: 'center',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
});

const IconWrap = styled('div', {
  display: 'flex',
  justifyContent: 'center',
  marginBottom: '$6',
});

const IconSvg = styled('svg', {
  display: 'block',
  opacity: 0.45,
});

const Heading = styled('h2', {
  margin: 0,
  marginBottom: '$3',
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$xl',
  lineHeight: 1.3,
  color: '$black',
});

const Subtext = styled('p', {
  margin: 0,
  marginBottom: '$7',
  fontFamily: '$poppins',
  fontWeight: '$regular',
  fontSize: '$md',
  lineHeight: 1.65,
  color: '$gray500',
  maxWidth: '420px',
  marginLeft: 'auto',
  marginRight: 'auto',
});

export type EmptyStateProps = {
  onOpenModal: () => void;
  disabled?: boolean;
};

/** Empty proposals ledger — premium panel with gradient primary CTA. */
export function EmptyState({ onOpenModal, disabled }: EmptyStateProps) {
  return (
    <Root
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <IconWrap aria-hidden>
        <IconSvg width={56} height={56} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="6" width="36" height="44" rx="4" stroke="#A1A1AA" strokeWidth="2" fill="none" />
          <path d="M18 22h20M18 30h14M18 38h20" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" />
          <circle cx="38" cy="14" r="6" fill="#E4E4E7" stroke="#A1A1AA" strokeWidth="1.5" />
          <path d="M35.5 14L37.2 15.8 41 12" stroke="#71717A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </IconSvg>
      </IconWrap>
      <Heading>No Active Proposals</Heading>
      <Subtext>
        The ledger is currently empty. Be the first to initiate a governance vote.
      </Subtext>
      <Button type="button" variant="primary" fullWidth disabled={disabled} onClick={onOpenModal}>
        Create the first proposal
      </Button>
    </Root>
  );
}
