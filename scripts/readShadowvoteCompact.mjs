/**
 * Lightweight feature flags from `contracts/shadowvote.compact` (no compactc required).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const compactPath = path.join(root, 'contracts', 'shadowvote.compact');

export function readShadowvoteCompactSource() {
  return fs.readFileSync(compactPath, 'utf8');
}

/** Count top-level parameters in `constructor(...)` (handles single-line compact). */
export function shadowvoteConstructorArgCount(source = readShadowvoteCompactSource()) {
  const m = source.match(/constructor\s*\(([^)]*)\)\s*\{/);
  if (!m) return 1;
  const inner = m[1].trim();
  if (!inner) return 0;
  return inner.split(',').map((s) => s.trim()).filter(Boolean).length;
}

export function shadowvoteCompactHasAdminPreimageWitness(source = readShadowvoteCompactSource()) {
  return /witness\s+adminPreimage\s*\(\s*\)/.test(source);
}
