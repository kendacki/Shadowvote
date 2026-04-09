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
- **Contract Address:** `d07a075a45de0e9d3f5ebe7425a917d2ad38a68939d21f7a5efd7228b3fc5e26`
- **Wallet Extension:** Requires [Midnight Lace Wallet] https://chromewebstore.google.com/detail/lace-midnight-preview/hgeekaiplokcnmakghbdfbgnlfheichg to interact via the browser.

*(Note: Because this is deployed on the Preprod network, you will need tNight tokens from the Midnight Faucet to execute transactions).*

## Local development

### 1. Clone and install

```bash
git clone <your-fork-or-repo-url> shadowvote
cd shadowvote
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and fill at least:

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
docker compose up proof-server
# listens on http://127.0.0.1:6300 — set PROOF_SERVER_URL in .env if needed
```

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Connect Lace, then use **Dashboard** for proposals and votes.

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
