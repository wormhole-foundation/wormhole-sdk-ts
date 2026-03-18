import { ChainContext, ChainToPlatform, Network } from "@wormhole-foundation/sdk-connect";
import { XrplChains } from "./types.js";

export class XrplChain<N extends Network, C extends XrplChains> extends ChainContext<N, C, ChainToPlatform<C>> {

}
