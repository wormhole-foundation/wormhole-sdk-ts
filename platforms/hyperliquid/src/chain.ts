import type {
  Network,
} from '@wormhole-foundation/sdk-connect';
import { ChainContext } from '@wormhole-foundation/sdk-connect';
import type { HyperliquidChains } from './types.js';

export class HyperliquidChain<
  N extends Network = Network,
  C extends HyperliquidChains = HyperliquidChains,
> extends ChainContext<N, C> {}
