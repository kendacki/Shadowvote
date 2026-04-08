/**
 * One-off helper: derive Midnight HD seed hex from a BIP39 mnemonic.
 * Never commit mnemonics. Pass via environment only:
 *
 *   MIDNIGHT_MNEMONIC="your 24 words here" node get-key.mjs
 */
import bip39 from 'bip39';
import * as ed from 'ed25519-hd-key';

const mnemonic = process.env.MIDNIGHT_MNEMONIC?.trim();

if (!mnemonic) {
  console.error(
    'Set MIDNIGHT_MNEMONIC to your space-separated phrase (quoted), then run:\n  node get-key.mjs',
  );
  process.exit(1);
}

try {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const result = ed.derivePath("m/44'/2400'/0'/0'/0'", seed.toString('hex'));
  console.log('\nDerived 32-byte key material (hex, for tooling only — treat as secret):\n');
  console.log(result.key.toString('hex'));
  console.log('');
} catch (err) {
  console.error('Derivation failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
