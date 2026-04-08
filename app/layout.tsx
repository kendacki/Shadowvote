import type { Metadata } from 'next';
import { NetworkBanner } from '@/components/NetworkBanner';
import { Poppins } from 'next/font/google';
import { ClientRoot } from './ClientRoot';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'ShadowVote — Anonymous Governance',
  description: 'Private voting on Midnight with zero-knowledge proofs.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body style={{ fontFamily: 'var(--font-poppins), Poppins, system-ui, sans-serif' }}>
        <NetworkBanner />
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
