#!/usr/bin/env node
/**
 * One-time / repeat local setup: `.env` from template, browser private-state password,
 * sanity checks for contract build + proof server reachability.
 *
 *   node scripts/setup.mjs           # apply fixes (default)
 *   node scripts/setup.mjs --check   # read-only report
 */
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

const checkOnly = process.argv.includes('--check');

function readEnvRaw() {
  if (!fs.existsSync(envPath)) return '';
  return fs.readFileSync(envPath, 'utf8');
}

function getKey(raw, key) {
  const m = raw.match(new RegExp(`^${escapeRe(key)}=(.*)$`, 'm'));
  if (!m) return undefined;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function setOrAppendKey(raw, key, value) {
  const lines = raw.split(/\r?\n/);
  let found = false;
  const out = lines.map((line) => {
    const m = line.match(/^([^=#\s][^=]*?)=(.*)$/);
    if (m && m[1].trim() === key) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    if (out[out.length - 1] !== '') out.push('');
    out.push(`${key}=${value}`);
  }
  return out.join('\n');
}

function assertBuildArtifacts() {
  const contractIndex = path.join(root, 'build', 'contract', 'index.js');
  const zkDir = path.join(root, 'public', 'shadowvote-zk');
  return {
    contract: fs.existsSync(contractIndex),
    zkPublic: fs.existsSync(zkDir) && fs.readdirSync(zkDir).length > 0,
  };
}

function proofUrlFromEnv(raw) {
  return getKey(raw, 'PROOF_SERVER_URL') || 'http://127.0.0.1:6300';
}

function tcpCheck(host, port, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const sock = net.createConnection({ host, port }, () => {
      if (done) return;
      done = true;
      clearTimeout(t);
      sock.end();
      resolve(true);
    });
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(false);
    }, timeoutMs);
    sock.on('error', () => {
      if (done) return;
      done = true;
      clearTimeout(t);
      resolve(false);
    });
    sock.on('connect', () => clearTimeout(t));
  });
}

async function checkProofServer(raw) {
  let u;
  try {
    u = new URL(proofUrlFromEnv(raw));
  } catch {
    return { ok: false, detail: 'invalid PROOF_SERVER_URL' };
  }
  const port = u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80;
  const ok = await tcpCheck(u.hostname, port, 4000);
  return { ok, detail: `${u.host}` };
}

function generatePrivateStateSecret() {
  return randomBytes(24).toString('base64url');
}

let raw = readEnvRaw();
let wrote = false;

if (!fs.existsSync(envPath)) {
  if (!fs.existsSync(examplePath)) {
    console.error('[setup] Missing .env.example — cannot bootstrap .env');
    process.exit(1);
  }
  if (checkOnly) {
    console.log('[setup] No .env yet — copy .env.example to .env and fill secrets (or run setup without --check).');
  } else {
    fs.copyFileSync(examplePath, envPath);
    raw = fs.readFileSync(envPath, 'utf8');
    wrote = true;
    console.log('[setup] Created .env from .env.example — add MIDNIGHT_SEED_HEX and other secrets.');
  }
} else {
  raw = readEnvRaw();
}

if (!checkOnly && raw) {
  let next = raw;
  const browserPw = getKey(next, 'NEXT_PUBLIC_MIDNIGHT_PRIVATE_STATE_PASSWORD');
  const midPw = getKey(next, 'MIDNIGHT_PRIVATE_STATE_PASSWORD');
  const needBrowser = !browserPw || browserPw.length < 16;
  const needMid = !midPw || midPw.length < 16;

  if (needBrowser || needMid) {
    const secret = generatePrivateStateSecret();
    if (needBrowser) {
      next = setOrAppendKey(next, 'NEXT_PUBLIC_MIDNIGHT_PRIVATE_STATE_PASSWORD', secret);
      console.log('[setup] Set NEXT_PUBLIC_MIDNIGHT_PRIVATE_STATE_PASSWORD (min 16 chars).');
    }
    if (needMid) {
      next = setOrAppendKey(next, 'MIDNIGHT_PRIVATE_STATE_PASSWORD', secret);
      console.log('[setup] Set MIDNIGHT_PRIVATE_STATE_PASSWORD to match (optional for Node scripts).');
    }
    fs.writeFileSync(envPath, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
    wrote = true;
    raw = fs.readFileSync(envPath, 'utf8');
  }
}

const artifacts = assertBuildArtifacts();
const seedHex = getKey(raw, 'MIDNIGHT_SEED_HEX');
const seedOk = !!seedHex && /^[0-9a-fA-F]{64}$/.test(seedHex);

console.log('\n[setup] Status');
console.log(`  .env exists:        ${fs.existsSync(envPath)}`);
console.log(`  MIDNIGHT_SEED_HEX: ${seedOk ? '64 hex chars OK' : 'missing or invalid (needed for npm run deploy)'}`);
console.log(
  `  browser L2 password: ${(getKey(raw, 'NEXT_PUBLIC_MIDNIGHT_PRIVATE_STATE_PASSWORD') || '').length >= 16 ? 'OK' : 'needs ≥16 chars'}`,
);
console.log(`  build/contract:     ${artifacts.contract ? 'OK' : 'run: npm run compile:contract'}`);
console.log(`  public ZK assets:    ${artifacts.zkPublic ? 'OK' : 'run: npm run zk:public'}`);

const proof = await checkProofServer(raw);
console.log(
  `  proof server TCP:   ${proof.ok ? `reachable (${proof.detail})` : `not reachable (${proof.detail}) — run npm run start-proof-server in another terminal`}`,
);

if (wrote && !checkOnly) {
  console.log('\n[setup] Updated .env on disk.');
}

console.log(`
Next steps:
  1. Ensure Docker runs; then: npm run start-proof-server
  2. In another terminal: npm run compile:contract && npm run zk:public  (if build/ or public ZK missing)
  3. npm run deploy  (needs MIDNIGHT_SEED_HEX + proof server)
  4. npm run dev
`);
