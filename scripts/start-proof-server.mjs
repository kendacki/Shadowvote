#!/usr/bin/env node
/**
 * Starts `docker-compose.yml` proof-server using Compose V2 (`docker compose`) when available,
 * otherwise falls back to `docker-compose` (V1 / standalone).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '..');
const extraArgs = process.argv.slice(2);
const composeUp = ['compose', 'up', ...extraArgs, 'proof-server'];
const legacyUp = ['up', ...extraArgs, 'proof-server'];
const shell = process.platform === 'win32';

function isWsl() {
  if (process.platform !== 'linux') return false;
  try {
    return /microsoft/i.test(readFileSync('/proc/version', 'utf8'));
  } catch {
    return false;
  }
}

/** @param {boolean} inherit */
function spawnDocker(args, inherit) {
  return spawnSync('docker', args, {
    cwd: root,
    stdio: inherit ? 'inherit' : 'pipe',
    shell,
  });
}

function printDockerUnavailableHelp() {
  const wsl = isWsl();
  console.error(`
[start-proof-server] Docker is not usable from this terminal.

${wsl ? `You are in WSL2 but the Docker CLI cannot talk to Docker Desktop.

Fix (recommended):
  1. Start Docker Desktop on Windows.
  2. Settings → Resources → WSL integration → enable your distro (e.g. Ubuntu).
  3. Apply & Restart.
  4. New WSL tab → run:  docker version
  5. Then:  npm run start-proof-server

More help: https://docs.docker.com/desktop/wsl/

Alternative: open PowerShell or CMD on Windows (not WSL), cd to this project, run:
  npm run start-proof-server
` : `Install and start Docker Desktop (or Docker Engine), then ensure
  docker version
works in this same terminal.`}
`);
}

/** True if \`docker\` runs and can reach the daemon. */
function dockerDaemonReachable() {
  const r = spawnDocker(['version'], false);
  if (r.error?.code === 'ENOENT') return false;
  if (r.status !== 0) return false;
  const out = `${r.stdout?.toString?.() ?? ''}\n${r.stderr?.toString?.() ?? ''}`;
  return /Server:/i.test(out);
}

if (!dockerDaemonReachable()) {
  const once = spawnDocker(['version'], false);
  if (once.error?.code === 'ENOENT') printDockerUnavailableHelp();
  else {
    console.error(`
[start-proof-server] Docker is installed but the daemon is not reachable from this shell.

• Start Docker Desktop (Windows) or the Docker service (Linux).
${isWsl() ? '• In WSL: Docker Desktop → Settings → Resources → WSL integration → enable this distro.\n' : ''}• Then run: docker version
`);
  }
  process.exit(1);
}

function hasComposePlugin() {
  return spawnDocker(['compose', 'version'], false).status === 0;
}

if (hasComposePlugin()) {
  const r = spawnDocker(composeUp, true);
  if (r.status === 0) process.exit(0);
  console.error('\n[start-proof-server] docker compose up failed — see Docker output above.');
  process.exit(r.status ?? 1);
}

const r2 = spawnSync('docker-compose', legacyUp, {
  cwd: root,
  stdio: 'inherit',
  shell,
});

if (r2.error?.code === 'ENOENT') {
  console.error(`
[start-proof-server] No Compose on this machine ("docker compose version" failed and "docker-compose" not found).

• Use Docker Desktop (includes Compose V2) and enable WSL integration if you use WSL.
• Or install Compose: https://docs.docker.com/compose/install/

Verify:  docker compose version
`);
  process.exit(1);
}

process.exit(r2.status ?? 1);
