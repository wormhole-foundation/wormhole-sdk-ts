import { Chain, ChainContext, Network } from "@wormhole-foundation/connect-sdk";
import { SuiChains, SuiPlatformType } from "./types";

export class SuiChain<
  N extends Network = Network,
  C extends Chain = SuiChains,
> extends ChainContext<N, SuiPlatformType, C> {}
