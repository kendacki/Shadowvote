'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Body, Caption, FeatureBody, FeatureTitle, H2 } from '@/components/Typography';
import { useMidnightWallet } from '@/hooks/useMidnightWallet';
import { gradientPrimary, styled } from '@/stitches.config';

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
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'center',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '$5 $5 0',
  '@md': { padding: '$6 $7 0' },
});

const NavCenter = styled('nav', {
  display: 'none',
  '@md': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '$6',
  },
});

const NavLink = styled('a', {
  fontFamily: '$poppins',
  fontSize: '$sm',
  fontWeight: '$regular',
  color: '#A1A1AA',
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'color 0.2s',
  '&:hover': { color: '#F4F4F5' },
});

const HeaderRight = styled('div', {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '$3',
});

const Brand = styled(Link, {
  display: 'flex',
  alignItems: 'center',
  gap: '$3',
  textDecoration: 'none',
  color: 'inherit',
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
  fontSize: '$lg',
  letterSpacing: '-0.03em',
  background: gradientPrimary,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
});

const SignUpBtn = styled('button', {
  all: 'unset',
  boxSizing: 'border-box',
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$sm',
  padding: '$2 $5',
  borderRadius: '$pill',
  cursor: 'pointer',
  background: gradientPrimary,
  color: '#FFFFFF',
  boxShadow: '0 8px 28px rgba(185, 28, 28, 0.35)',
  transition: 'transform 0.2s, box-shadow 0.2s',
  '&:hover': { transform: 'translateY(-1px)' },
});

const HeroGrid = styled('section', {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '$8 $5 $10',
  display: 'grid',
  gap: '$8',
  alignItems: 'center',
  '@lg': {
    gridTemplateColumns: '1fr 1fr',
    gap: '$9',
    padding: '$9 $7 $11',
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
  fontSize: '$lg',
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

const FloatCard = styled(motion.div, {
  position: 'absolute',
  zIndex: 2,
  bottom: '12%',
  left: '0',
  padding: '$3 $4',
  borderRadius: '$md',
  backgroundColor: 'rgba(15, 15, 20, 0.85)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(12px)',
  fontFamily: '$poppins',
  fontSize: '$xs',
  color: '#D4D4D8',
  boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
  '@md': { left: '4%' },
});

const Section = styled('section', {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '0 $5 $10',
  '@md': { padding: '0 $7 $11' },
});

const SectionTitle = styled('h2', {
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$xl',
  textAlign: 'center',
  color: '#FAFAFA',
  margin: '0 0 $8 0',
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
  fontSize: '22px',
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

const Partners = styled('div', {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '$8',
  padding: '$8 0',
  opacity: 0.45,
  filter: 'grayscale(1)',
});

const PartnerWord = styled('span', {
  fontFamily: '$poppins',
  fontWeight: '$semibold',
  fontSize: '$md',
  color: '#71717A',
  letterSpacing: '0.02em',
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
  padding: '$9 $5 $6',
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

const SocialRow = styled('div', {
  display: 'flex',
  gap: '$3',
  marginTop: '$4',
});

const SocialBtn = styled('a', {
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.12)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#A1A1AA',
  fontSize: '$xs',
  fontWeight: '$semibold',
  textDecoration: 'none',
  '&:hover': { borderColor: 'rgba(248,113,113,0.4)', color: '#F87171' },
});

const Copyright = styled('p', {
  textAlign: 'center',
  fontFamily: '$poppins',
  fontSize: '$xs',
  color: '#52525B',
  margin: '$8 0 0',
});

const BoardWrap = styled('div', {
  position: 'relative',
});

const BoardTrigger = styled('button', {
  all: 'unset',
  fontFamily: '$poppins',
  fontSize: '$sm',
  fontWeight: '$regular',
  color: '#A1A1AA',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  transition: 'color 0.2s',
  '&:hover': { color: '#F4F4F5' },
});

const Dropdown = styled(motion.div, {
  position: 'absolute',
  top: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginTop: '$2',
  minWidth: '160px',
  padding: '$2',
  borderRadius: '$md',
  backgroundColor: '#14141a',
  border: '1px solid rgba(255,255,255,0.1)',
  boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
  zIndex: 50,
});

const DropdownLink = styled(Link, {
  display: 'block',
  padding: '$2 $3',
  borderRadius: '$sm',
  fontFamily: '$poppins',
  fontSize: '$sm',
  color: '#D4D4D8',
  textDecoration: 'none',
  '&:hover': { backgroundColor: 'rgba(248,113,113,0.12)', color: '#FAFAFA' },
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
  const [boardOpen, setBoardOpen] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const closeBoard = useCallback(() => setBoardOpen(false), []);

  useEffect(() => {
    if (!boardOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (boardRef.current && !boardRef.current.contains(e.target as Node)) {
        setBoardOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [boardOpen]);

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

                <NavCenter>
                  <NavLink href="#roadmap">Roadmap</NavLink>
                  <BoardWrap ref={boardRef}>
                    <BoardTrigger type="button" onClick={() => setBoardOpen((o) => !o)} aria-expanded={boardOpen}>
                      Board
                      <span aria-hidden style={{ fontSize: '10px' }}>
                        ▾
                      </span>
                    </BoardTrigger>
                    <AnimatePresence>
                      {boardOpen ? (
                        <Dropdown
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.2 }}
                        >
                          <DropdownLink href="/dashboard" onClick={closeBoard}>
                            Dashboard
                          </DropdownLink>
                          <DropdownLink href="/dashboard" onClick={closeBoard}>
                            Proposals
                          </DropdownLink>
                        </Dropdown>
                      ) : null}
                    </AnimatePresence>
                  </BoardWrap>
                  <NavLink href="https://docs.midnight.network" target="_blank" rel="noreferrer">
                    Updates
                  </NavLink>
                  <NavLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      void wallet.connect();
                    }}
                  >
                    {wallet.isConnected ? 'Wallet' : 'Login'}
                  </NavLink>
                </NavCenter>

                <HeaderRight>
                  {wallet.isConnected && wallet.unshieldedAddress ? (
                    <Caption css={{ color: '#A1A1AA', maxWidth: '140px', textAlign: 'right', display: 'none', '@sm': { display: 'block' } }}>
                      {wallet.unshieldedAddress.slice(0, 10)}…{wallet.unshieldedAddress.slice(-6)}
                    </Caption>
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
                    }}
                  >
                    {wallet.isConnected ? 'Disconnect' : 'Connect'}
                  </Button>
                  <SignUpBtn type="button" onClick={() => router.push('/dashboard')}>
                    Open app
                  </SignUpBtn>
                </HeaderRight>
              </Header>

              <HeroGrid>
                <div>
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
                  <FloatCard initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                    ZK proof ready → submit via Lace
                  </FloatCard>
                </HeroVisual>
              </HeroGrid>

              <Section id="roadmap">
                <SectionTitle>What to do next</SectionTitle>
                <CardGrid>
                  {[
                    {
                      iconLabel: 'C',
                      title: 'Create a proposal',
                      body: 'Register a new proposal ID and seed it with your first shielded interaction.',
                      href: '/dashboard',
                      cta: 'Open dashboard',
                    },
                    {
                      iconLabel: 'V',
                      title: 'Cast a private vote',
                      body: 'Generate a zero-knowledge proof locally — your choice never leaves your device in plaintext.',
                      href: '/dashboard',
                      cta: 'Start voting',
                    },
                    {
                      iconLabel: 'R',
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
                      <IconCircle aria-hidden>{f.iconLabel}</IconCircle>
                      <FeatureTitle css={{ color: '#FAFAFA', marginBottom: '$2' }}>{f.title}</FeatureTitle>
                      <FeatureBody css={{ color: '#A1A1AA' }}>{f.body}</FeatureBody>
                      <CardLink href={f.href}>
                        {f.cta} <span aria-hidden>›</span>
                      </CardLink>
                    </FeatureCard>
                  ))}
                </CardGrid>
              </Section>

              <Section aria-label="Partners">
                <Partners>
                  {['Midnight', 'Lace', 'Preprod', 'Compact'].map((name) => (
                    <PartnerWord key={name}>{name}</PartnerWord>
                  ))}
                </Partners>
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
                  <NlRow
                    onSubmit={(e) => {
                      e.preventDefault();
                    }}
                  >
                    <EmailInput type="email" name="email" placeholder="Your email" autoComplete="email" />
                    <SignUpBtn type="submit">Subscribe</SignUpBtn>
                  </NlRow>
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
                    <SocialRow>
                      <SocialBtn href="https://docs.midnight.network" target="_blank" rel="noreferrer">
                        D
                      </SocialBtn>
                      <SocialBtn href="https://midnight.network" target="_blank" rel="noreferrer">
                        M
                      </SocialBtn>
                    </SocialRow>
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
