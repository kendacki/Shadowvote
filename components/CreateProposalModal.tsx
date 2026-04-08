'use client';

import { Button } from '@/components/Button';
import { Body, Caption, H2 } from '@/components/Typography';
import { styled } from '@/stitches.config';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useId, useState } from 'react';

const Backdrop = styled(motion.div, {
  position: 'fixed',
  inset: 0,
  zIndex: 9000,
  backgroundColor: 'rgba(10, 10, 10, 0.35)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '$5',
});

const Dialog = styled(motion.div, {
  width: '100%',
  maxWidth: '440px',
  backgroundColor: '$white',
  borderRadius: '$lg',
  border: '1px solid $gray200',
  boxShadow: '0 24px 64px rgba(15, 23, 42, 0.12)',
  padding: '$6',
});

const Field = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '$2',
  marginBottom: '$5',
});

const Label = styled('label', {
  fontFamily: '$poppins',
  fontSize: '$sm',
  fontWeight: '$semibold',
  color: '$black',
});

const Input = styled('input', {
  fontFamily: '$poppins',
  fontSize: '$md',
  padding: '$3 $4',
  borderRadius: '$md',
  border: '1px solid $gray200',
  outline: 'none',
  color: '$gray600',
  '&:focus': {
    borderColor: '$red400',
    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.15)',
  },
});

const Actions = styled('div', {
  display: 'flex',
  flexDirection: 'column-reverse',
  gap: '$3',
  marginTop: '$2',
  '& > *': { width: '100%' },
  '@sm': {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    '& > *': { width: 'auto' },
  },
});

export type CreateProposalModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { title: string; proposalId: number }) => void | Promise<void>;
  isSubmitting?: boolean;
};

export function CreateProposalModal({
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: CreateProposalModalProps) {
  const headingId = useId();
  const proposalTitleInputId = useId();
  const idFieldId = useId();
  const [title, setTitle] = useState('');
  const [proposalIdRaw, setProposalIdRaw] = useState('');

  useEffect(() => {
    if (!open) {
      setTitle('');
      setProposalIdRaw('');
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    const n = Number.parseInt(proposalIdRaw.trim(), 10);
    if (!Number.isFinite(n) || n < 0 || n > 0xffffffff) {
      return;
    }
    await onSubmit({ title: title.trim(), proposalId: n });
  }, [onSubmit, proposalIdRaw, title]);

  const validId =
    proposalIdRaw.trim() !== '' &&
    Number.isFinite(Number.parseInt(proposalIdRaw.trim(), 10)) &&
    Number.parseInt(proposalIdRaw.trim(), 10) >= 0;

  return (
    <AnimatePresence>
      {open ? (
        <Backdrop
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="presentation"
        >
          <Dialog
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
          >
            <Caption css={{ marginBottom: '$2' }}>ShadowVote</Caption>
            <H2 id={headingId} css={{ marginBottom: '$2' }}>
              New proposal
            </H2>
            <Body css={{ marginBottom: '$5', fontSize: '$sm' }}>
              On this contract, a proposal is registered on-chain when it receives its first vote. Submitting here runs
              the same ZK vote flow for your chosen numeric ID (title is stored locally for your reference only).
            </Body>

            <Field>
              <Label htmlFor={idFieldId}>Proposal ID (number)</Label>
              <Input
                id={idFieldId}
                type="text"
                inputMode="numeric"
                placeholder="e.g. 42"
                value={proposalIdRaw}
                onChange={(e) => setProposalIdRaw(e.target.value.replace(/[^\d]/g, ''))}
                autoComplete="off"
              />
            </Field>

            <Field>
              <Label htmlFor={proposalTitleInputId}>Title / label (optional)</Label>
              <Input
                id={proposalTitleInputId}
                type="text"
                placeholder="e.g. Treasury allocation Q2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoComplete="off"
              />
            </Field>

            <Actions>
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!validId || isSubmitting}
                onClick={() => void handleSubmit()}
              >
                {isSubmitting ? 'Working…' : 'Submit proposal'}
              </Button>
            </Actions>
          </Dialog>
        </Backdrop>
      ) : null}
    </AnimatePresence>
  );
}
