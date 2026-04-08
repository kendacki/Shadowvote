/**
 * Next/webpack: `@midnight-ntwrk/midnight-js-indexer-public-data-provider` imports `WebSocket` from
 * `isomorphic-ws`, whose ESM interop does not always expose a named export. Re-export the global.
 */
const WS: typeof globalThis.WebSocket =
  typeof globalThis !== 'undefined' && typeof globalThis.WebSocket === 'function'
    ? globalThis.WebSocket
    : (function MissingWebSocket() {
        throw new Error('WebSocket is not available in this environment');
      } as unknown as typeof globalThis.WebSocket);

export { WS as WebSocket };
export default WS;
