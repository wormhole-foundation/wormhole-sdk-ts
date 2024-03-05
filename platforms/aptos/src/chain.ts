import { ChainContext, Network } from "@wormhole-foundation/sdk-connect";
import { AptosChains } from "./types";

export class AptosChain<N extends Network, C extends AptosChains> extends ChainContext<N, C> {}
