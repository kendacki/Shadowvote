import {
  createProverKey,
  createVerifierKey,
  createZKIR,
  ZKConfigProvider,
} from '@midnight-ntwrk/midnight-js-types';

const KEY_DIR = 'keys';
const ZKIR_DIR = 'zkir';
const PROVER_EXT = '.prover';
const VERIFIER_EXT = '.verifier';
const ZKIR_EXT = '.bzkir';

/**
 * Browser-friendly {@link ZKConfigProvider}: fetches prover / verifier / zkIR bytes over HTTP
 * using the same layout as {@link NodeZkConfigProvider} (`keys/`, `zkir/`, `.bzkir`).
 *
 * Serve `build/keys` and `build/zkir` under {@link baseUrl} (e.g. copy to `public/shadowvote-zk`).
 */
export class HttpZkConfigProvider<K extends string> extends ZKConfigProvider<K> {
  constructor(readonly baseUrl: string) {
    super();
  }

  private assetUrl(subDir: string, circuitId: K, ext: string): string {
    const root = this.baseUrl.replace(/\/$/, '');
    return `${root}/${subDir}/${circuitId}${ext}`;
  }

  private async fetchBytes(url: string): Promise<Uint8Array> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Failed to load ZK asset (${res.status}): ${url}. ` +
          `Copy build/keys and build/zkir into your public folder (see package.json "zk:public").`,
      );
    }
    return new Uint8Array(await res.arrayBuffer());
  }

  getProverKey(circuitId: K): Promise<ReturnType<typeof createProverKey>> {
    return this.fetchBytes(this.assetUrl(KEY_DIR, circuitId, PROVER_EXT)).then(createProverKey);
  }

  getVerifierKey(circuitId: K): Promise<ReturnType<typeof createVerifierKey>> {
    return this.fetchBytes(this.assetUrl(KEY_DIR, circuitId, VERIFIER_EXT)).then(createVerifierKey);
  }

  getZKIR(circuitId: K): Promise<ReturnType<typeof createZKIR>> {
    return this.fetchBytes(this.assetUrl(ZKIR_DIR, circuitId, ZKIR_EXT)).then(createZKIR);
  }
}
