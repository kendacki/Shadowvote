/**
 * midnight-js uses a process-global network id. Deploy scripts set this in `scripts/utils.ts`;
 * the browser must set it too before `findDeployedContract`, `callTx`, etc.
 */
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

const id = (process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK_ID ?? 'preprod').trim();
setNetworkId(id);
