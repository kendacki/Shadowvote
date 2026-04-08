'use client';

import { styled } from '@/stitches.config';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';

const StyledButton = styled(motion.button, {
  all: 'unset',
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '$2',
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$md',
  cursor: 'pointer',
  borderRadius: '$pill',
  padding: '$3 $6',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  '&:disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  variants: {
    variant: {
      primary: {
        color: '$white',
        background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
        boxShadow: '$buttonPrimary',
        '&:hover:not(:disabled)': {
          transform: 'translateY(-1px)',
          boxShadow: '0 12px 28px rgba(185, 28, 28, 0.32)',
        },
        '&:active:not(:disabled)': {
          transform: 'translateY(0)',
        },
      },
      secondary: {
        color: '$black',
        backgroundColor: '$white',
        border: '1px solid $gray200',
        boxShadow: '$soft',
        '&:hover:not(:disabled)': {
          borderColor: '$gray400',
          transform: 'translateY(-1px)',
        },
        '&:active:not(:disabled)': {
          transform: 'translateY(0)',
        },
      },
    },
    fullWidth: {
      true: { width: '100%' },
    },
  },
  defaultVariants: {
    variant: 'primary',
  },
});

export type ButtonProps = HTMLMotionProps<'button'> & {
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', fullWidth, children, ...props }, ref) => (
    <StyledButton
      ref={ref}
      variant={variant}
      fullWidth={fullWidth}
      whileTap={{ scale: props.disabled ? 1 : 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      {...props}
    >
      {children}
    </StyledButton>
  ),
);

Button.displayName = 'Button';
