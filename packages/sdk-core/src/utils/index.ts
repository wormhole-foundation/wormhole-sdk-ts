import { Context, WormholeConfig } from '../types.js';

export * from './createNonce.js';
export * from './array.js';
export * from './vaa/index.js';

export function filterByContext(config: WormholeConfig, context: Context) {
  return Object.values(config.chains).filter((c) => c.context === context);
}
