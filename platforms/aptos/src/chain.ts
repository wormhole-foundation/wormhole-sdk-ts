import type { Network } from "@wormhole-foundation/sdk-connect";
import { ChainContext } from "@wormhole-foundation/sdk-connect";
import type { AptosChains } from "./types.js";

export class AptosChain<
  N extends Network = Network,
  C extends AptosChains = AptosChains,
> extends ChainContext<N, C> {}
