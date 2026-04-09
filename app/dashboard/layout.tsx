'use client';

import { TopNav } from '@/components/TopNav';
import { styled } from '@/stitches.config';

const RouteRoot = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  width: '100%',
  minHeight: 0,
  minWidth: 0,
  position: 'relative',
  backgroundColor: '#FFFFFF',
});

const MainPlane = styled('div', {
  flex: 1,
  width: '100%',
  minWidth: 0,
  minHeight: 0,
});

/** White nav + wallet chrome only for app routes; marketing `/` stays dark-only. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteRoot>
      <TopNav />
      <MainPlane>{children}</MainPlane>
    </RouteRoot>
  );
}
