import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** Prefer this project as tracing root when multiple lockfiles exist (e.g. under home). */
  outputFileTracingRoot: path.join(__dirname),
  reactStrictMode: true,
  /**
   * Heavy native/WASM Midnight packages: avoid SSR bundle edge cases on Vercel where the graph
   * only needs them in client islands (`ssr: false` dashboards still benefit from clearer server traces).
   */
  serverExternalPackages: [
    '@midnight-ntwrk/ledger-v8',
    '@midnight-ntwrk/onchain-runtime-v3',
    '@midnight-ntwrk/ledger',
    '@midnight-ntwrk/ledger-v7',
  ],
  transpilePackages: [
    '@midnight-ntwrk/wallet-sdk-facade',
    '@midnight-ntwrk/wallet-sdk-shielded',
    '@midnight-ntwrk/wallet-sdk-unshielded-wallet',
    '@midnight-ntwrk/wallet-sdk-dust-wallet',
    '@midnight-ntwrk/midnight-js-indexer-public-data-provider',
    '@midnight-ntwrk/midnight-js-level-private-state-provider',
  ],
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      /** Module graph layers; useful for some WASM / async dependency graphs (safe no-op if already default). */
      layers: true,
      topLevelAwait: true,
    };
    /** WASM async loaders emit async/await; tell webpack the runtime supports it (avoids bogus build warnings). */
    config.output = config.output ?? {};
    config.output.environment = {
      ...config.output.environment,
      asyncFunction: true,
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      '@shadowvote/contract': path.resolve(__dirname, 'build/contract/index.js'),
      'isomorphic-ws': path.resolve(__dirname, 'lib/shims/isomorphic-ws.ts'),
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      ...(!isServer ? { child_process: false } : {}),
    };
    return config;
  },
};

export default nextConfig;
