# ShadowVote

Private, Sybil-resistant governance on **Midnight**: prove voter eligibility in zero knowledge, cast votes through **Lace**, and watch tallies update in real time—without exposing wallet identities on-chain.

## Features

- **ZK voting** — Compact contract (`contracts/shadowvote.compact`) with local proof generation via Midnight JS and your configured ZK artifacts.
- **Merkle membership** — Depth-20 voter tree using Midnight `persistentHash` / `transientHash` semantics (`utils/merkle.ts`); constructor `voterRoot` must match the deployed registry.
- **Sybil resistance** — Per-(secret, proposal) nullifiers on the public ledger; the app computes nullifiers locally and surfaces **Vote cast** when your nullifier appears (`utils/crypto.ts`, Phase 5).
- **Live sync** — Contract state stream (RxJS) plus polling fallback in `useShadowVote` so tallies and nullifier sets stay current.
- **Network awareness** — Amber banner on non-mainnet builds (`components/NetworkBanner.tsx`, `config/network.ts`).
- **Polished UX** — [Stitches](https://stitches.dev/) design tokens, [Framer Motion](https://www.framer.com/motion/) transitions, global toasts.

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
| `VOTER_REGISTRY_LEAVES_HEX` / `NEXT_PUBLIC_VOTER_REGISTRY_LEAVES_HEX` | Comma-separated **leaf** hashes (`voterLeafHash`); must match deploy `voterRoot`. |

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

Writes `deployment.json` including `voterRootField` — keep registry env vars in sync.

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

## Project layout (high level)

```
app/              App Router pages (landing, dashboard, proposal detail)
components/       UI (Stitches + Motion)
config/           Network tier helpers
contexts/         Toast provider
contracts/        Compact sources
hooks/            Wallet, identity, ShadowVote / indexer sync
lib/              Providers, contract load, voter registry
public/           Static assets + shadowvote-zk after zk:public
scripts/          deploy.ts, compile helpers
utils/            Merkle tree, nullifier crypto
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
