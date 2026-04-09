'use client';

import { Button } from '@/components/Button';
import { Body, Caption, H2 } from '@/components/Typography';
import { useToast } from '@/contexts/ToastContext';
import { useSupabaseSync } from '@/hooks/useSupabaseSync';
import { styled } from '@/stitches.config';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';

const Backdrop = styled(motion.div, {
  position: 'fixed',
  inset: 0,
  zIndex: 9000,
  backgroundColor: 'rgba(10, 10, 10, 0.38)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
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
  /** Preferred prop name for visibility. */
  isOpen?: boolean;
  /** @deprecated use `isOpen` */
  open?: boolean;
  onClose: () => void;
  /** Runs after a successful Supabase insert (localStorage / UI side effects only). */
  onSubmit: (payload: { title: string; proposalId: number }) => void | Promise<void>;
  /** Legacy: wallet voting state; primary submit uses internal Supabase save state. */
  isSubmitting?: boolean;
};

export function CreateProposalModal({
  isOpen,
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: CreateProposalModalProps) {
  const visible = Boolean(isOpen ?? open);
  const toast = useToast();
  const { publishProposal, isConfigured } = useSupabaseSync();
  const headingId = useId();
  const proposalTitleInputId = useId();
  const idFieldId = useId();
  const [title, setTitle] = useState('');
  const [proposalIdRaw, setProposalIdRaw] = useState('');
  const [isSavingOffChain, setIsSavingOffChain] = useState(false);
  /** Portals attach after mount so SSR/hydration never targets a missing `document.body`. */
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setProposalIdRaw('');
      setIsSavingOffChain(false);
    }
  }, [visible]);

  const handleSubmit = useCallback(async () => {
    const n = Number.parseInt(proposalIdRaw.trim(), 10);
    if (!Number.isFinite(n) || n < 0 || n > 0xffffffff) {
      return;
    }
    if (!isConfigured) {
      toast.error('Supabase is not configured', 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }
    const trimmedTitle = title.trim();
    const displayTitle = trimmedTitle || `Proposal #${n}`;
    setIsSavingOffChain(true);
    try {
      await publishProposal({
        id: String(n),
        title: displayTitle,
        status: 'Pending First Vote',
      });
      toast.success('Proposal saved to off-chain registry!');
      await Promise.resolve(onSubmit({ title: trimmedTitle, proposalId: n }));
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save proposal';
      toast.error('Could not save proposal', msg);
    } finally {
      setIsSavingOffChain(false);
    }
  }, [isConfigured, onClose, onSubmit, proposalIdRaw, publishProposal, title, toast]);

  const validId =
    proposalIdRaw.trim() !== '' &&
    Number.isFinite(Number.parseInt(proposalIdRaw.trim(), 10)) &&
    Number.parseInt(proposalIdRaw.trim(), 10) >= 0;

  const tree = (
    <AnimatePresence>
      {visible ? (
        <Backdrop
          key="shadowvote-create-proposal"
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
            onPointerDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
          >
            <Caption css={{ marginBottom: '$2' }}>ShadowVote</Caption>
            <H2 id={headingId} css={{ marginBottom: '$2' }}>
              New proposal
            </H2>
            <Body css={{ marginBottom: '$5', fontSize: '$sm' }}>
              New proposals are saved to the off-chain registry (Supabase) until the first vote lands on Midnight. Then
              the tally syncs from the indexer. Optionally add a title for search and sharing.
            </Body>

            <Field>
              <Label htmlFor={idFieldId}>Proposal ID</Label>
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
              <Label htmlFor={proposalTitleInputId}>Proposal title (optional)</Label>
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
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSavingOffChain || isSubmitting}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!validId || isSavingOffChain || isSubmitting}
                onClick={() => void handleSubmit()}
              >
                {isSavingOffChain ? 'Saving…' : 'Submit proposal'}
              </Button>
            </Actions>
          </Dialog>
        </Backdrop>
      ) : null}
    </AnimatePresence>
  );

  if (!portalReady || typeof document === 'undefined') {
    return null;
  }

  return createPortal(tree, document.body);
}
