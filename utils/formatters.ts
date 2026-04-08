export type TruncateAddressOptions = {
  /** Characters to keep at the start (after trim). Default 7 (e.g. `mn_addr`). */
  head?: number;
  /** Characters to keep at the end (e.g. `3q9q`). Default 4. */
  tail?: number;
};

/**
 * Shortens long Midnight / bech32-style addresses for UI rows.
 * Example style: `mn_addr_preprod18qxf5qtcw4cj…` → `mn_addr...3q9q` (exact slices depend on length).
 */
export function truncateAddress(
  address: string | null | undefined,
  options: TruncateAddressOptions = {},
): string {
  if (address == null) return '—';
  const trimmed = address.trim();
  if (trimmed === '') return '—';

  const head = options.head ?? 7;
  const tail = options.tail ?? 4;
  const minLen = head + tail + 3;
  if (trimmed.length <= minLen) return trimmed;

  return `${trimmed.slice(0, head)}...${trimmed.slice(-tail)}`;
}

/** Compact tNight display for headers and badges. */
export function formatTNight(amount: bigint | null | undefined): string {
  if (amount == null) return '—';
  const whole = amount / 1_000_000n;
  const frac = (amount % 1_000_000n).toString().padStart(6, '0').slice(0, 2);
  return `${whole.toString()}.${frac} tNight`;
}
