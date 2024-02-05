import { ChainContext, Network } from "@wormhole-foundation/connect-sdk";
import { AptosChains } from "./types";

export class AptosChain<N extends Network, C extends AptosChains> extends ChainContext<N, C> {}
