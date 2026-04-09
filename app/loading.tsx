/** Route-level Suspense fallback — keep this non-fixed so it cannot cover the hydrated page if boundaries glitch. */
export default function Loading() {
  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
        color: '#52525b',
        fontSize: '0.9375rem',
      }}
    >
      Loading…
    </div>
  );
}
