import type { ChainToPlatform, Network } from "@wormhole-foundation/sdk-connect";
import { ChainContext } from "@wormhole-foundation/sdk-connect";
import type { BtcChains } from "./types.js";

export class BtcChain<N extends Network, C extends BtcChains> extends ChainContext<N, C, ChainToPlatform<C>> {}
