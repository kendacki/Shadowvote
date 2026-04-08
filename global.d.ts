import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

declare global {
  interface Window {
    /** Injected by Lace / compatible Midnight wallets (see dapp-connector-api). */
    midnight?: Record<string, InitialAPI>;
  }
}

export {};
