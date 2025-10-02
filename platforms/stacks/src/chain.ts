import { ChainContext, ChainToPlatform, Network } from "@wormhole-foundation/sdk-connect";
import { StacksChains } from "./types.js";

export class StacksChain<N extends Network, C extends StacksChains> extends ChainContext<N, C, ChainToPlatform<C>> {
  
}
