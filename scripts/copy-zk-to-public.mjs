#!/usr/bin/env node
/**
 * Copies `build/keys` and `build/zkir` into `public/shadowvote-zk` so the browser can fetch
 * prover / verifier / zkIR artifacts (see `HttpZkConfigProvider`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const destRoot = path.join(root, 'public', 'shadowvote-zk');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[zk:public] skip (missing): ${path.relative(root, src)}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

copyDir(path.join(root, 'build', 'keys'), path.join(destRoot, 'keys'));
copyDir(path.join(root, 'build', 'zkir'), path.join(destRoot, 'zkir'));
console.log(`[zk:public] synced → ${path.relative(root, destRoot)}`);
