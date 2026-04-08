'use client';

import { styled, keyframes } from '@/stitches.config';
import type { ToastRecord } from '@/lib/toastTypes';
import { AnimatePresence, motion } from 'framer-motion';

export type { ToastRecord } from '@/lib/toastTypes';

const pulse = keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.72 },
});

const Stack = styled('div', {
  position: 'fixed',
  right: '$5',
  bottom: '$5',
  zIndex: 10000,
  display: 'flex',
  flexDirection: 'column',
  gap: '$3',
  alignItems: 'flex-end',
  pointerEvents: 'none',
  maxWidth: 'min(420px, calc(100vw - 40px))',
  '@md': { right: '$7', bottom: '$7' },
});

const ToastSurface = styled(motion.div, {
  position: 'relative',
  pointerEvents: 'auto',
  borderRadius: '$md',
  padding: '$4 $5',
  paddingRight: '$8',
  boxShadow: '0 12px 40px rgba(15, 23, 42, 0.12)',
  fontFamily: '$poppins',
  fontSize: '$sm',
  lineHeight: 1.45,
  border: '1px solid',
  variants: {
    variant: {
      info: {
        backgroundColor: '#EFF6FF',
        borderColor: '#BFDBFE',
        color: '#1E3A8A',
      },
      success: {
        backgroundColor: '#F0FDF4',
        borderColor: '#BBF7D0',
        color: '#14532D',
      },
      error: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
        color: '#991B1B',
      },
      loading: {
        backgroundColor: '$white',
        borderColor: '$gray200',
        color: '$gray600',
        backgroundImage: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(185, 28, 28, 0.12) 100%)',
      },
    },
  },
  defaultVariants: { variant: 'info' },
});

const Title = styled('div', {
  fontWeight: '$semibold',
  marginBottom: '$1',
});

const Body = styled('div', {
  fontWeight: '$regular',
  fontSize: '$xs',
  opacity: 0.95,
});

const LoadingBar = styled('div', {
  marginTop: '$3',
  height: '3px',
  borderRadius: '$pill',
  background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
  animation: `${pulse} 1.2s ease-in-out infinite`,
});

type ToastStackProps = {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
};

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <Stack aria-live="polite" aria-relevant="additions text">
      <AnimatePresence initial={false} mode="popLayout">
        {toasts.map((t) => (
          <ToastSurface
            key={t.id}
            layout
            variant={t.variant}
            role="status"
            initial={{ opacity: 0, y: 16, x: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, x: 8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <Title>{t.title}</Title>
            {t.message ? <Body>{t.message}</Body> : null}
            {t.variant === 'loading' ? <LoadingBar /> : null}
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              style={{
                position: 'absolute',
                top: 8,
                right: 10,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
                opacity: 0.55,
                padding: 4,
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </ToastSurface>
        ))}
      </AnimatePresence>
    </Stack>
  );
}
