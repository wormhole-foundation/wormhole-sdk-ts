import type { Chain, Network } from "@wormhole-foundation/sdk-connect";
import { ChainContext } from "@wormhole-foundation/sdk-connect";
import type { SuiChains } from "./types";

export class SuiChain<
  N extends Network = Network,
  C extends Chain = SuiChains,
> extends ChainContext<N, C> {}
