#!/usr/bin/env node
/**
 * Invokes the Midnight Compact CLI without shadowing Windows' `compact.exe` (NTFS compression).
 *
 * Official CLI (Linux/macOS installer): `compact compile <source> <outDir>`
 * Some setups still expose `compactc` as a shim — we try both.
 *
 * @see https://docs.midnight.network/getting-started/installation
 * @see https://docs.midnight.network/compact/compilation-and-tooling/compiler-usage
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '..');
const compileArgs = ['compile', 'contracts/shadowvote.compact', 'build'];

function run(cmd) {
  return spawnSync(cmd, compileArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

const tryOrder =
  process.platform === 'win32'
    ? ['compactc', 'compact']
    : ['compact', 'compactc'];

for (const cmd of tryOrder) {
  const r = run(cmd);
  if (r.status === 0) process.exit(0);
  if (r.error?.code === 'ENOENT') continue;
  process.exit(r.status ?? 1);
}

console.error(`
[compile:contract] Compact compiler not found (${tryOrder.join(' / ')}).
Toolchain install (Linux / macOS — official):

  curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh

Then restart the terminal (or: source ~/.bashrc  /  source ~/.zshrc) and ensure
~/.compact/bin is on PATH. Verify:

  compact --version
  compact compile --version

Run compile from the project root:

  compact compile contracts/shadowvote.compact build

Windows: Midnight documents Linux/Mac for the Compact toolchain; use WSL2
and install Compact inside Linux, then run npm run compile:contract from
/mnt/c/.../Midnight inside WSL. Do NOT use the Windows built-in "compact"
command (NTFS compression).

Docs:
  https://docs.midnight.network/getting-started/installation
  https://docs.midnight.network/compact/compilation-and-tooling/compiler-usage
`);
process.exit(1);
