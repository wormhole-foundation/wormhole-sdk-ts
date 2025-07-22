import { ChainContext, ChainToPlatform, Network } from "@wormhole-foundation/sdk-connect";

export class StacksChain<N extends Network, C extends "Stacks"> extends ChainContext<N, C, ChainToPlatform<C>> {
  
}
