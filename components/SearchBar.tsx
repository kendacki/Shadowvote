'use client';

import { styled } from '@/stitches.config';
import type { ChangeEvent } from 'react';

const Wrapper = styled('div', {
  position: 'relative',
  width: '100%',
});

const SearchIcon = styled('svg', {
  position: 'absolute',
  left: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  width: '18px',
  height: '18px',
  color: '$gray500',
  pointerEvents: 'none',
});

const Input = styled('input', {
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: '$poppins',
  fontWeight: '$regular',
  fontSize: '$md',
  lineHeight: 1.4,
  color: '$black',
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '$md',
  padding: '$3 $4',
  paddingLeft: '44px',
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  '&::placeholder': {
    color: '$gray500',
  },
  '&:focus': {
    borderColor: 'rgba(239, 68, 68, 0.55)',
    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.12)',
  },
});

export type SearchBarProps = {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
};

function SearchGlyph({ className }: { className?: string }) {
  return (
    <SearchIcon className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM16.5 16.5L21 21"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SearchIcon>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search proposals by title or ID…',
  id,
  'aria-label': ariaLabel = 'Search proposals',
}: SearchBarProps) {
  return (
    <Wrapper>
      <SearchGlyph />
      <Input
        id={id}
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
        aria-label={ariaLabel}
      />
    </Wrapper>
  );
}
