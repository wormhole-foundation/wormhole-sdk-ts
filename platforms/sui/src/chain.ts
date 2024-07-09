import type { Network } from "@wormhole-foundation/sdk-connect";
import { ChainContext } from "@wormhole-foundation/sdk-connect";
import type { SuiChains } from "./types.js";

export class SuiChain<
  N extends Network = Network,
  C extends SuiChains = SuiChains,
> extends ChainContext<N, C> {}
