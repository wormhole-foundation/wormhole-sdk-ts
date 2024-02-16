import { Chain, ChainContext, Network } from "@wormhole-foundation/connect-sdk";
import { SuiChains } from "./types";

export class SuiChain<
  N extends Network = Network,
  C extends Chain = SuiChains,
> extends ChainContext<N, C> {}
