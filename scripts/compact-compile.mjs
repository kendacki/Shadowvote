#!/usr/bin/env node
/**
 * Invokes the Midnight Compact CLI without shadowing Windows' `compact.exe` (NTFS compression).
 * Install the official Compact toolchain so `compactc` is on your PATH.
 * @see https://docs.midnight.network/develop/reference/compact/
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = ['compile', 'contracts/shadowvote.compact', 'build'];
const tryRun = (cmd) =>
  spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

const r = tryRun('compactc');
if (r.status === 0) process.exit(0);

console.error(`
[compile:contract] "compactc" not found or failed.
Install the Midnight Compact compiler and add "compactc" to PATH.

On Windows, do NOT use the built-in "compact" command (that is NTFS compression).

Official docs:
  https://docs.midnight.network/develop/reference/compact/

Example (Unix / Git Bash with compact on PATH):
  compact compile contracts/shadowvote.compact build
`);
process.exit(r.status ?? 1);
