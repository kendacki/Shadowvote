'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Body, Caption, FeatureBody, FeatureTitle, H2 } from '@/components/Typography';
import { useMidnightWallet } from '@/hooks/useMidnightWallet';
import { gradientPrimary, styled } from '@/stitches.config';
import { formatTNight, truncateAddress } from '@/utils/formatters';
import { supabase } from '@/utils/supabase';

/** Prefer a raster PNG with transparency at `public/shadowvote-logo.png`; falls back to vector emblem. */
const LOGO_SRC = '/shadowvote-logo.png';
const LOGO_FALLBACK = '/shadowvote-emblem.svg';

const Page = styled('div', {
  minHeight: '100vh',
  backgroundColor: '#030306',
  color: '#E4E4E7',
  position: 'relative',
  overflowX: 'hidden',
});

const Blob = styled('div', {
  position: 'absolute',
  borderRadius: '50%',
  filter: 'blur(80px)',
  pointerEvents: 'none',
  zIndex: 0,
});

const Content = styled('div', {
  position: 'relative',
  zIndex: 1,
});

const Header = styled(motion.header, {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  columnGap: '$2',
  maxWidth: '1200px',
  margin: '0 auto',
  paddingTop: '$3',
  paddingBottom: 0,
  paddingLeft: 'max($4, env(safe-area-inset-left, 0px))',
  paddingRight: 'max($4, env(safe-area-inset-right, 0px))',
  '@xs': { columnGap: '$3', paddingTop: '$4' },
  '@md': {
    columnGap: '$4',
    paddingTop: '$5',
    paddingLeft: '$7',
    paddingRight: '$7',
  },
});

const HeaderWalletMeta = styled('div', {
  display: 'none',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '2px',
  minWidth: 0,
  maxWidth: 'min(200px, 28vw)',
  '@sm': { display: 'flex' },
});

const HeaderRight = styled('div', {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '$2',
  minWidth: 0,
  flexShrink: 0,
  '@xs': { gap: '$3' },
});

const HeaderEnd = styled('div', {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '$2',
  minWidth: 0,
  '@xs': { gap: '$3' },
});

const Brand = styled(Link, {
  display: 'flex',
  alignItems: 'center',
  gap: '$2',
  minWidth: 0,
  textDecoration: 'none',
  color: 'inherit',
  '@xs': { gap: '$3' },
});

const LogoImg = styled('img', {
  width: '44px',
  height: '44px',
  objectFit: 'contain',
  flexShrink: 0,
});

const BrandWordmark = styled('span', {
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$md',
  letterSpacing: '-0.03em',
  background: gradientPrimary,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  '@xs': { fontSize: '$lg' },
});

const SignUpBtn = styled('button', {
  all: 'unset',
  boxSizing: 'border-box',
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$xs',
  padding: '$2 $3',
  borderRadius: '$pill',
  cursor: 'pointer',
  background: gradientPrimary,
  color: '#FFFFFF',
  boxShadow: '0 8px 28px rgba(185, 28, 28, 0.35)',
  transition: 'transform 0.2s, box-shadow 0.2s',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  '@xs': { fontSize: '$sm', padding: '$2 $5' },
  '&:hover': { transform: 'translateY(-1px)' },
});

const HeroGrid = styled('section', {
  maxWidth: '1200px',
  margin: '$2 auto 0',
  padding: '$5 max($4, env(safe-area-inset-left, 0px)) $5 max($4, env(safe-area-inset-right, 0px))',
  display: 'grid',
  gap: '$5',
  alignItems: 'center',
  '@xs': { marginTop: '$3', padding: '$6 $5 $6', gap: '$6' },
  '@lg': {
    gridTemplateColumns: '1fr 1fr',
    gap: '$7',
    marginTop: '$4',
    padding: '$7 max($7, env(safe-area-inset-left, 0px)) $7 max($7, env(safe-area-inset-right, 0px))',
  },
});

const Overline = styled('p', {
  fontFamily: '$poppins',
  fontSize: '11px',
  fontWeight: '$semibold',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#F87171',
  margin: '0 0 $4 0',
});

const HeroTitle = styled('h1', {
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: 'clamp(2rem, 4.5vw, 3.25rem)',
  lineHeight: 1.12,
  letterSpacing: '-0.03em',
  color: '#FAFAFA',
  margin: '0 0 $5 0',
});

const UnderlineWord = styled('span', {
  backgroundImage: 'linear-gradient(135deg, #F87171 0%, #DC2626 55%, #991B1B 100%)',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '100% 0.42em',
  backgroundPosition: '0 88%',
  paddingBottom: '0.06em',
});

const Sub = styled('p', {
  fontFamily: '$poppins',
  fontSize: 'clamp(0.9375rem, 2.8vw, 1.125rem)',
  lineHeight: 1.65,
  color: '#A1A1AA',
  maxWidth: '520px',
  margin: '0 0 $7 0',
});

const HeroVisual = styled(motion.div, {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '280px',
  width: '100%',
  '@lg': { minHeight: '380px' },
});

const WatermarkLogo = styled('img', {
  position: 'absolute',
  zIndex: 0,
  width: 'min(90vw, 420px)',
  height: 'auto',
  opacity: 0.07,
  pointerEvents: 'none',
  userSelect: 'none',
});

const HeroLogo = styled(motion.img, {
  position: 'relative',
  zIndex: 1,
  width: 'min(72vw, 320px)',
  height: 'auto',
  maxHeight: '360px',
  objectFit: 'contain',
  filter: 'drop-shadow(0 24px 48px rgba(239, 68, 68, 0.25))',
});

/** Positions the hero float pill without fighting Framer `x` transforms. */
const FloatCardAnchor = styled('div', {
  position: 'absolute',
  zIndex: 2,
  bottom: '8%',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(280px, calc(100vw - 32px))',
  '@xs': { width: 'min(320px, calc(100vw - 40px))' },
  '@md': { left: '4%', transform: 'none', width: 'auto', maxWidth: '360px' },
});

const FloatCard = styled(motion.div, {
  padding: '$3 $4',
  borderRadius: '$md',
  backgroundColor: 'rgba(15, 15, 20, 0.85)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(12px)',
  fontFamily: '$poppins',
  fontSize: '11px',
  textAlign: 'center',
  color: '#D4D4D8',
  boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
  '@xs': { fontSize: '$xs' },
  '@md': { textAlign: 'left' },
});

const Section = styled('section', {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '0 max($4, env(safe-area-inset-left, 0px)) $10 max($4, env(safe-area-inset-right, 0px))',
  '@md': { padding: '0 max($7, env(safe-area-inset-left, 0px)) $11 max($7, env(safe-area-inset-right, 0px))' },
});

const CardGrid = styled('div', {
  display: 'grid',
  gap: '$5',
  '@md': { gridTemplateColumns: 'repeat(3, 1fr)', gap: '$6' },
});

const FeatureCard = styled(motion.article, {
  backgroundColor: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
  padding: '$6',
  boxShadow: '0 4px 32px rgba(0,0,0,0.35)',
  transition: 'border-color 0.25s',
  '&:hover': {
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
});

const IconCircle = styled('div', {
  width: '48px',
  height: '48px',
  borderRadius: '14px',
  background: 'linear-gradient(135deg, rgba(239,68,68,0.25) 0%, rgba(127,29,29,0.4) 100%)',
  border: '1px solid rgba(248,113,113,0.25)',
  marginBottom: '$4',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#FAFAFA',
  '& svg': { display: 'block' },
});

const CardLink = styled(Link, {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '$2',
  marginTop: '$5',
  padding: '$2 $3',
  borderRadius: '$md',
  border: '1px solid rgba(255,255,255,0.12)',
  fontFamily: '$poppins',
  fontSize: '$sm',
  fontWeight: '$semibold',
  color: '#F87171',
  textDecoration: 'none',
  transition: 'background 0.2s, border-color 0.2s',
  '&:hover': {
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderColor: 'rgba(248,113,113,0.35)',
  },
});

const Newsletter = styled(motion.div, {
  maxWidth: '960px',
  margin: '0 auto $10',
  padding: '$8 $6',
  borderRadius: '24px',
  background: 'linear-gradient(145deg, rgba(30, 58, 138, 0.35) 0%, rgba(12, 18, 32, 0.95) 45%, rgba(69, 10, 10, 0.35) 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
  textAlign: 'center',
  position: 'relative',
  boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
});

const NlRow = styled('form', {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '$3',
  justifyContent: 'center',
  marginTop: '$5',
  alignItems: 'center',
});

const EmailInput = styled('input', {
  flex: '1 1 240px',
  maxWidth: '360px',
  padding: '$3 $4',
  borderRadius: '$pill',
  border: '1px solid rgba(255,255,255,0.15)',
  backgroundColor: 'rgba(0,0,0,0.35)',
  color: '#FAFAFA',
  fontFamily: '$poppins',
  fontSize: '$sm',
  outline: 'none',
  '&::placeholder': { color: '#71717A' },
  '&:focus': { borderColor: 'rgba(248,113,113,0.5)' },
});

const Footer = styled('footer', {
  borderTop: '1px solid rgba(255,255,255,0.06)',
  padding: '$9 max($5, env(safe-area-inset-left, 0px)) $6 max($5, env(safe-area-inset-right, 0px))',
  maxWidth: '1200px',
  margin: '0 auto',
});

const FooterGrid = styled('div', {
  display: 'grid',
  gap: '$8',
  gridTemplateColumns: '1fr',
  '@md': { gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '$6' },
});

const FooterColTitle = styled('h3', {
  fontFamily: '$poppins',
  fontSize: '$sm',
  fontWeight: '$semibold',
  color: '#FAFAFA',
  margin: '0 0 $4 0',
});

const FooterLink = styled('a', {
  display: 'block',
  fontFamily: '$poppins',
  fontSize: '$sm',
  color: '#A1A1AA',
  textDecoration: 'none',
  marginBottom: '$3',
  '&:hover': { color: '#F4F4F5' },
});

const Copyright = styled('p', {
  textAlign: 'center',
  fontFamily: '$poppins',
  fontSize: '$xs',
  color: '#52525B',
  margin: '$8 0 0',
});

function LogoWithFallback() {
  const [src, setSrc] = useState(LOGO_SRC);
  return (
    <LogoImg
      src={src}
      alt=""
      width={44}
      height={44}
      onError={() => {
        if (src !== LOGO_FALLBACK) setSrc(LOGO_FALLBACK);
      }}
    />
  );
}

/** Feature card icons — line SVGs aligned with create / private vote / results. */
function IconCreateProposal() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M12 11v6M9 14h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconPrivateVote() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="m9 12 2 2 4-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconViewResults() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M7 16V9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M12 16v-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M17 16V7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function HeroEmblem() {
  const [src, setSrc] = useState(LOGO_SRC);
  return (
    <>
      <WatermarkLogo
        src={src}
        alt=""
        aria-hidden
        onError={() => {
          if (src !== LOGO_FALLBACK) setSrc(LOGO_FALLBACK);
        }}
      />
      <HeroLogo
        src={src}
        alt="ShadowVote"
        initial={{ y: 0 }}
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        onError={() => {
          if (src !== LOGO_FALLBACK) setSrc(LOGO_FALLBACK);
        }}
      />
    </>
  );
}

export default function HomePage() {
  const router = useRouter();
  const wallet = useMidnightWallet();
  const blocking = wallet.isLoading || wallet.isConnecting;

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubscribe = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('1. Form submitted with email:', email);

    if (!email.trim()) return;

    if (!supabase) {
      console.error('Supabase client not configured (missing NEXT_PUBLIC_SUPABASE_* env).');
      setErrorMessage('Something went wrong. Please try again.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage('');
    try {
      console.log('2. Attempting Supabase insertion...');
      const trimmed = email.trim();
      const { error } = await supabase.from('subscribers').insert([{ email: trimmed }]);

      if (error) {
        console.error('3. Supabase Error:', error);
        if (error.code === '23505') {
          setErrorMessage('You are already on the list!');
        } else {
          setErrorMessage(error.message || 'Something went wrong.');
        }
        setStatus('error');
        return;
      }

      console.log('4. Supabase insertion successful!');
      setStatus('success');
      setEmail('');
    } catch (err) {
      console.error('3. Caught Exception:', err);
      setErrorMessage('Network error occurred.');
      setStatus('error');
    }
  };
  return (
    <Page>
      <Blob
        css={{ width: '420px', height: '420px', background: 'rgba(239, 68, 68, 0.12)', top: '-120px', left: '-100px' }}
      />
      <Blob
        css={{
          width: '380px',
          height: '380px',
          background: 'rgba(59, 130, 246, 0.08)',
          top: '20%',
          right: '-120px',
        }}
      />
      <Blob
        css={{
          width: '300px',
          height: '300px',
          background: 'rgba(127, 29, 29, 0.2)',
          bottom: '10%',
          left: '15%',
        }}
      />

      <Content>
        <AnimatePresence mode="wait">
          {blocking ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <LoadingScreen message={wallet.isConnecting ? 'Connecting wallet' : 'Loading'} />
            </motion.div>
          ) : (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }}>
              <Header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <Brand href="/">
                  <LogoWithFallback />
                  <BrandWordmark>ShadowVote</BrandWordmark>
                </Brand>

                <HeaderEnd>
                  <HeaderRight>
                    {wallet.isConnected && wallet.unshieldedAddress ? (
                      <HeaderWalletMeta>
                        <Caption
                          title={wallet.unshieldedAddress}
                          css={{
                            color: '#A1A1AA',
                            textAlign: 'right',
                            fontFamily: 'ui-monospace, "Cascadia Mono", monospace',
                            fontSize: '11px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            width: '100%',
                          }}
                        >
                          {truncateAddress(wallet.unshieldedAddress)}
                        </Caption>
                        <Caption css={{ color: '#71717A', textAlign: 'right', fontSize: '10px' }}>
                          {formatTNight(wallet.tNightBalance)}
                        </Caption>
                      </HeaderWalletMeta>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => (wallet.isConnected ? wallet.disconnect() : wallet.connect())}
                      style={{
                        borderColor: 'rgba(255,255,255,0.2)',
                        backgroundColor: 'transparent',
                        color: '#F4F4F5',
                        boxShadow: 'none',
                        padding: '10px 14px',
                        fontSize: '0.875rem',
                      }}
                    >
                      {wallet.isConnected ? 'Disconnect' : 'Connect'}
                    </Button>
                    <SignUpBtn type="button" onClick={() => router.push('/dashboard')}>
                      Open app
                    </SignUpBtn>
                  </HeaderRight>
                </HeaderEnd>
              </Header>

              <HeroGrid>
                <div style={{ minWidth: 0, width: '100%' }}>
                  <Overline>Private governance · Zero-knowledge</Overline>
                  <HeroTitle>
                    <UnderlineWord>Cast</UnderlineWord> and <UnderlineWord>Vote</UnderlineWord> on Shielded Proposals.
                  </HeroTitle>
                  <Sub>
                    Anonymous governance on Midnight: prove membership without revealing identity. Your vote stays
                    private; integrity stays public.
                  </Sub>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12, duration: 0.5 }}
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}
                  >
                    <Button type="button" variant="primary" onClick={() => router.push('/dashboard')}>
                      Get started
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => window.open('https://docs.midnight.network', '_blank')}
                      style={{
                        borderColor: 'rgba(255,255,255,0.2)',
                        backgroundColor: 'transparent',
                        color: '#E4E4E7',
                      }}
                    >
                      Documentation
                    </Button>
                  </motion.div>
                </div>

                <HeroVisual>
                  <HeroEmblem />
                  <FloatCardAnchor>
                    <FloatCard initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                      ZK proof ready → submit via Lace
                    </FloatCard>
                  </FloatCardAnchor>
                </HeroVisual>
              </HeroGrid>

              <Section id="roadmap" aria-label="Getting started">
                <CardGrid css={{ marginTop: '$4', '@md': { marginTop: '$5' } }}>
                  {[
                    {
                      Icon: IconCreateProposal,
                      title: 'Create a proposal',
                      body: 'Register a new proposal ID and seed it with your first shielded interaction.',
                      href: '/dashboard',
                      cta: 'Open dashboard',
                    },
                    {
                      Icon: IconPrivateVote,
                      title: 'Cast a private vote',
                      body: 'Generate a zero-knowledge proof locally — your choice never leaves your device in plaintext.',
                      href: '/dashboard',
                      cta: 'Start voting',
                    },
                    {
                      Icon: IconViewResults,
                      title: 'View results',
                      body: 'Tallies update on-chain while individual ballots stay unlinkable.',
                      href: '/dashboard',
                      cta: 'See proposals',
                    },
                  ].map((f, i) => (
                    <FeatureCard
                      key={f.title}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ delay: 0.08 * i, duration: 0.45 }}
                    >
                      <IconCircle aria-hidden>
                        <f.Icon />
                      </IconCircle>
                      <FeatureTitle css={{ color: '#FAFAFA', marginBottom: '$2' }}>{f.title}</FeatureTitle>
                      <FeatureBody css={{ color: '#A1A1AA' }}>{f.body}</FeatureBody>
                      <CardLink href={f.href}>
                        {f.cta} <span aria-hidden>›</span>
                      </CardLink>
                    </FeatureCard>
                  ))}
                </CardGrid>
              </Section>

              <Section>
                <Newsletter
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  <motion.div
                    initial={{ rotate: -8 }}
                    animate={{ rotate: [ -8, -4, -8 ] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    style={{
                      position: 'absolute',
                      top: '-14px',
                      right: '24px',
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: gradientPrimary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '18px',
                      boxShadow: '0 8px 24px rgba(185,28,28,0.4)',
                    }}
                    aria-hidden
                  >
                    @
                  </motion.div>
                  <H2 css={{ color: '#FAFAFA', fontSize: '$xl', marginBottom: '$3' }}>Stay in the loop</H2>
                  <Body css={{ color: '#A1A1AA', maxWidth: '480px', margin: '0 auto' }}>
                    Get updates on ShadowVote and Midnight testnet releases. No spam — unsubscribe anytime.
                  </Body>
                  {status === 'success' ? (
                    <Body
                      css={{
                        color: '#A1A1AA',
                        maxWidth: '480px',
                        margin: '$5 auto 0',
                        fontFamily: '$poppins',
                        fontSize: '$sm',
                      }}
                    >
                      Thanks for subscribing! We&apos;ll keep you in the loop.
                    </Body>
                  ) : (
                    <>
                      <NlRow onSubmit={handleSubscribe}>
                        <EmailInput
                          type="email"
                          name="email"
                          placeholder="Your email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={status === 'loading'}
                        />
                        <SignUpBtn
                          type="submit"
                          disabled={status === 'loading'}
                          style={
                            status === 'loading'
                              ? { opacity: 0.85, cursor: 'wait' as const }
                              : undefined
                          }
                        >
                          {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
                        </SignUpBtn>
                      </NlRow>
                      {status === 'error' && errorMessage ? (
                        <Body
                          role="alert"
                          css={{
                            color: '#F87171',
                            fontSize: '$xs',
                            marginTop: '$3',
                            fontFamily: '$poppins',
                          }}
                        >
                          {errorMessage}
                        </Body>
                      ) : null}
                    </>
                  )}
                </Newsletter>
              </Section>

              {wallet.error ? (
                <Body role="alert" css={{ color: '#F87171', textAlign: 'center', padding: '0 $5 $4' }}>
                  {wallet.error}
                </Body>
              ) : null}

              <Footer>
                <FooterGrid>
                  <div>
                    <Brand href="/" css={{ marginBottom: '$4' }}>
                      <LogoWithFallback />
                      <BrandWordmark>ShadowVote</BrandWordmark>
                    </Brand>
                    <Body css={{ color: '#71717A', fontSize: '$sm', maxWidth: '280px' }}>
                      Private voting on Midnight with zero-knowledge proofs — governance without surveillance.
                    </Body>
                  </div>
                  <div>
                    <FooterColTitle>Resources</FooterColTitle>
                    <FooterLink href="https://docs.midnight.network" target="_blank" rel="noreferrer">
                      Docs
                    </FooterLink>
                    <FooterLink href="#roadmap">Roadmap</FooterLink>
                    <FooterLink href="/dashboard">Dashboard</FooterLink>
                  </div>
                  <div>
                    <FooterColTitle>Product</FooterColTitle>
                    <FooterLink href="/dashboard">Board</FooterLink>
                    <FooterLink href="https://docs.midnight.network" target="_blank" rel="noreferrer">
                      Updates
                    </FooterLink>
                  </div>
                  <div>
                    <FooterColTitle>Network</FooterColTitle>
                    <FooterLink href="#">Preprod</FooterLink>
                    <FooterLink href="https://docs.midnight.network" target="_blank" rel="noreferrer">
                      Support
                    </FooterLink>
                  </div>
                </FooterGrid>
                <Copyright>© {new Date().getFullYear()} ShadowVote. Built for Midnight.</Copyright>
              </Footer>
            </motion.div>
          )}
        </AnimatePresence>
      </Content>
    </Page>
  );
}
