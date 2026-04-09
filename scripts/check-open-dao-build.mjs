#!/usr/bin/env node
/**
 * Fails `next build` if `build/contract` is missing or still the Merkle-era bundle
 * (expects voterMembershipPath). Open DAO only uses voterSecret.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = path.join(root, 'build', 'contract', 'index.js');

if (!fs.existsSync(p)) {
  console.error('[check-open-dao-build] Missing build/contract/index.js');
  console.error('  Run: npm run compile:contract && npm run zk:public');
  process.exit(1);
}

const src = fs.readFileSync(p, 'utf8');
if (src.includes('voterMembershipPath')) {
  console.error(
    '[check-open-dao-build] CACHE MISMATCH: build/contract/index.js is Merkle-era (voterMembershipPath present).',
  );
  console.error('  Build aborted. Run: rm -rf .next && npm run compile:contract && npm run zk:public');
  process.exit(1);
}
