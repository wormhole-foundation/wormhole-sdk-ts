import { ChainContext, Network } from "@wormhole-foundation/connect-sdk";
import { AptosChains, AptosPlatformType } from "./types";

export class AptosChain<N extends Network, C extends AptosChains> extends ChainContext<
  N,
  AptosPlatformType,
  C
> {}
