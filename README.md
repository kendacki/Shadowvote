# ShadowVote

Private governance on **Midnight**: token-gated participation, zero-knowledge votes through **Lace**, and tallies in real time—without linking votes to wallet addresses on-chain.

## Features

- **ZK voting** — Compact contract (`contracts/shadowvote.compact`) with local proof generation via Midnight JS and your configured ZK artifacts.
- **Open DAO (no registry)** — Voting does not use a Merkle allowlist or Supabase `registered_voters`. Eligibility is enforced in the app via **minimum unshielded tNIGHT** before a local voter secret is used for ZK proofs.
- **Sybil resistance** — Per-(secret, proposal) nullifiers on the public ledger; the app computes nullifiers locally and surfaces **Vote cast** when your nullifier appears (`utils/crypto.ts`).
- **Live sync** — Contract state stream (RxJS) plus polling fallback in `useShadowVote` so tallies and nullifier sets stay current.
- **Network awareness** — Amber banner on non-mainnet builds (`components/NetworkBanner.tsx`, `config/network.ts`).
- **Polished UX** — [Stitches](https://stitches.dev/) design tokens, [Framer Motion](https://www.framer.com/motion/) transitions, global toasts.

## How the Voting Mechanism Works

ShadowVote operates as a frictionless, "Public DAO." To participate, users do not need to pre-register or wait for an admin to approve their wallet. The entire voting process is instant and entirely decentralized, broken down into three simple steps:

### Phase 1: Connection & Verification (Token Gate)
To protect the system from spam and fake accounts (Sybil attacks), ShadowVote uses a strictly enforced, on-chain token gate.
1. A user connects their Midnight Lace wallet to the dApp.
2. The application instantly checks the wallet's balance on the Midnight network.
3. **The Rule:** The wallet must hold a minimum of **1000 tNIGHT** tokens to participate. If the balance is insufficient, the UI locks the voting mechanism. 

### Phase 2: Private Proof Generation (Off-Chain)
If the user passes the token gate, they are cleared to vote without ever exposing their identity.
1. The user reviews the active proposal and selects "Yes" or "No".
2. Instead of sending the user's wallet address to the blockchain, the ShadowVote frontend silently generates a **Zero-Knowledge (ZK) Proof** in the browser. 
3. This cryptographic proof acts as a mathematical receipt that says: *"I hold the required tokens and am authorized to vote, but I will not reveal my identity."*
4. Alongside the proof, the system generates a unique **Nullifier** (a one-time passcode tied cryptographically to the proposal).

### Phase 3: Casting the Vote (On-Chain)
The final step is submitting the mathematically disguised vote to the network.
1. The user's wallet prompts them to sign the transaction containing the ZK Proof and Nullifier.
2. The Midnight smart contract receives the transaction. 
3. The contract validates the ZK math. It also checks the Nullifier to ensure this specific anonymous user hasn't already voted on this proposal.
4. If valid, the vote is added to the public tally, but the voter's identity and wallet address remain 100% hidden.

## Tech stack

| Layer | Choice |
| --- | --- |
| App framework | **Next.js 15** (App Router) |
| Styling | **@stitches/react** (`stitches.config.ts`) |
| Animation | **framer-motion** |
| On-chain / ZK | **@midnight-ntwrk/midnight-js***, **compact-js**, **compact-runtime**, **ledger-v8**, Lace **dapp-connector-api** |
| Contract source | **Compact** (`*.compact`) → managed JS in `build/contract` |
| State / async | **RxJS** (indexer contract observables) |

\*Exact package versions are pinned in `package.json`.

## Prerequisites

- **Node.js** 20+ recommended (aligned with Next 15 and Midnight JS).
- **Lace** (or compatible wallet) on **Preprod** when testing public networks.
- **Docker** (optional but recommended) for the local **proof server** used by scripts and CLI flows.

##  Network Deployments

ShadowVote is currently deployed on the Midnight test network. You can interact with the live contract using the following details:

- **Network:** Midnight Preprod
- **Contract Address:** `b1eb2448c2164288361542720e1b8a822a28c5f05bd1a1456fb24fa293536a65`
- **Wallet Extension:** Requires [Midnight Lace Wallet] https://chromewebstore.google.com/detail/lace-midnight-preview/hgeekaiplokcnmakghbdfbgnlfheichg to interact via the browser.

*(Note: Because this is deployed on the Preprod network, you will need tNight tokens from the Midnight Faucet to execute transactions).*

## Local development

### 1. Clone and install

```bash
git clone <your-fork-or-repo-url> shadowvote
cd shadowvote
npm install
npm run setup
```

`npm run setup` creates `.env` from `.env.example` if missing, fills browser/private-state passwords when empty, and prints a short health report (including whether the proof server port responds). Read-only check: `npm run setup:check`.

### 2. Environment

Copy `.env.example` to `.env` and fill at least (or use `npm run setup` to bootstrap the file and passwords):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SHADOWVOTE_CONTRACT_ADDRESS` | Deployed ledger address (hex). |
| `NEXT_PUBLIC_MIDNIGHT_PRIVATE_STATE_PASSWORD` | **≥16 chars** — Level.js private-state store (browser). |
| `NEXT_PUBLIC_MIDNIGHT_NETWORK_ID` or `NEXT_PUBLIC_MIDNIGHT_NETWORK` | e.g. `preprod` (banner uses the logical network). |
| `NEXT_PUBLIC_SHADOWVOTE_ZK_BASE` | URL or path to published ZK assets (default `/shadowvote-zk` after `npm run zk:public`). |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional: off-chain proposal “waiting room” (`public.proposals`). |

See `.env.example` for indexer URLs, deploy seed, and proof server host.

### 3. Compile contract & publish ZK artifacts

```bash
npm run compile:contract
npm run zk:public
```

Ensure `public/shadowvote-zk` (or your custom base URL) contains the prover artifacts expected by the Compact build.

### 4. Proof server (Midnight tutorial image)

Required for **CLI deployment** and some local proving flows:

```bash
npm run start-proof-server
# uses `docker compose` when available, otherwise `docker-compose`
# listens on http://127.0.0.1:6300 — set PROOF_SERVER_URL in .env if needed
```

**WSL2:** Docker must see your distro (Docker Desktop → **Settings → Resources → WSL integration**). If `docker version` fails inside WSL, run `npm run start-proof-server` from **PowerShell on Windows** instead, or fix integration and open a new WSL terminal.

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Connect Lace, then use **Dashboard** for proposals and votes.

If voting fails with **`CACHE MISMATCH ERROR`** or a witness error mentioning **`voterMembershipPath`**, Next.js is still serving the old Merkle `Contract` while this repo is **Open DAO** (only `voterSecret`). Recompile, republish ZK assets, and clear the Next cache:

```bash
npm run compile:contract
npm run zk:public
# Windows PowerShell:
Remove-Item -Recurse -Force .next
npm run dev
```

`npm run build` runs a check that `build/contract` matches Open DAO before producing a production bundle.

**Voting from an HTTPS site (e.g. Vercel)** — If you see *“Proof server is HTTP on localhost…”* or *`prove` … `Failed to fetch`*: browsers **cannot** call `http://127.0.0.1:6300` from `https://your-app.vercel.app` (mixed content + that host is **_your_ machine_, not visitors’). **`PROOF_SERVER_URL`** alone only helps **Node** (`npm run deploy`), not the **browser**. See **Deploying to Vercel → Proving** below.

### 6. Deploy contract (optional)

With wallet seed and proof server up:

```bash
npm run deploy
```

Writes `deployment.json` (contract address, `model: open-dao`, timestamp).

## Production build

Configuration lives in **`next.config.ts`** (TypeScript is the supported single source of truth for this repo). It includes:

- `experiments.asyncWebAssembly`, `layers`, and `topLevelAwait` for WASM-heavy Midnight dependencies.
- `output.environment.asyncFunction` for clean WASM loader output.
- `serverExternalPackages` for select `@midnight-ntwrk/*` ledger/WASM packages to reduce SSR tracing issues on Vercel.
- Aliases for `@shadowvote/contract` and the `isomorphic-ws` shim.

```bash
npm run build
npm start
```

## Deploying to Vercel

1. **Import** the Git repository and set the **Root Directory** to this project if it lives in a monorepo.
2. **Environment variables** — add all `NEXT_PUBLIC_*` values from `.env` in the Vercel project settings (Production + Preview as needed). Never commit secrets.
3. **Build** — `npm run build` (default Install Command `npm install`).
4. **Output** — Next.js default (no static export required).
5. **WASM** — `vercel.json` adds `Content-Type: application/wasm` for `*.wasm`. Do **not** add a SPA catch-all rewrite to `index.html` (that pattern breaks App Router).
6. **ZK assets** — Run `npm run zk:public` in CI before build, or host artifacts on a CDN and set `NEXT_PUBLIC_SHADOWVOTE_ZK_BASE` to that base URL.
7. **Mainnet** — Set `NEXT_PUBLIC_MIDNIGHT_NETWORK=mainnet` (or equivalent id) only when you intentionally ship prod; the **Network** banner hides on mainnet.

### Proving (ZK) on Vercel

Public Midnight docs assume a **local** proof server (`http://127.0.0.1:6300`). A hosted **HTTPS** app cannot call **HTTP localhost** from the browser (mixed content + wrong host). **CORS** may also block direct calls to some HTTPS provers.

**What works:**

1. **Lace in-wallet proving** — If the connector exposes `getProvingProvider`, this app uses it first (no extra env).
2. **Same-origin proof proxy (built-in)** — Set **`NEXT_PUBLIC_MIDNIGHT_USE_PROOF_PROXY=1`**. The browser posts to **`/api/midnight-proof/check`** and **`/prove`**; your **Vercel server** forwards to **`PROOF_SERVER_URL`** (or **`MIDNIGHT_PROOF_SERVER_INTERNAL_URL`**). That upstream must be reachable **from Vercel’s servers**, not from the visitor’s PC. Typical setup: run Docker proof-server locally and expose it with **ngrok** / **Cloudflare Tunnel** (`https://…` → `:6300`), then set **`PROOF_SERVER_URL`** on Vercel to that tunnel URL (server-only env is fine). Local `npm run dev` can use **`PROOF_SERVER_URL=http://127.0.0.1:6300`** with the proxy flag.
3. **Direct browser → prover** — Set **`NEXT_PUBLIC_MIDNIGHT_PROVER_SERVER_URI`** to an **HTTPS** origin the browser can call (and that allows your site’s origin if cross-origin).

`PROOF_SERVER_URL` is also used by **`npm run deploy`**; with the proxy enabled it doubles as the server-side proof upstream.

## Project layout

```
app/              App Router pages (landing, dashboard, proposal detail)
components/       UI (Stitches + Motion)
config/           Network tier helpers
contexts/         Toast provider
contracts/        Compact sources
hooks/            Wallet, identity, ShadowVote / indexer sync
lib/              Providers, contract loader
public/           Static assets + shadowvote-zk after zk:public
scripts/          deploy.ts, compile helpers
utils/            Nullifier / voting crypto helpers
build/            Generated contract + zkir (after compile)
```

## Security

- **Never commit** `.env`, seeds, mnemonics, or `deployment.json` if it ties to funded keys. This repository’s `.gitignore` excludes them; use `.env.example` as the template only.
- If a seed or mnemonic ever appeared in a file that was shared or committed, **rotate** it: move funds to a new wallet and treat the old material as compromised.
- `get-key.mjs` reads **`MIDNIGHT_MNEMONIC` from the environment only** — do not paste phrases into source files.
- `midnight.config.json` in the repo holds **public** endpoints only; keep wallet material in private config or env.

## License

- Review Midnight Foundation licensing for **ledger / compact / JS SDK** packages in `node_modules`.
- This README is documentation only; audit **contracts** and **deployment** before mainnet or high-value use.

## Support

- **Midnight** docs and tutorials: [Midnight Network](https://midnight.network/)
- Contract logic: `contracts/shadowvote.compact`
- Troubleshooting builds: confirm `next.config.ts` is unchanged by stale `vercel.json` SPA rewrites and that WASM files are reachable at `NEXT_PUBLIC_SHADOWVOTE_ZK_BASE`.
