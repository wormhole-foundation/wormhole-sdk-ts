import type { Provider } from '@project-serum/anchor';
import type { Connection } from '@solana/web3.js';

export function createReadOnlyProvider(
  connection?: Connection,
): Provider | undefined {
  if (connection === undefined) {
    return undefined;
  }
  return { connection };
}

export * from './account.js';
export * from './bpfLoaderUpgradeable.js';
