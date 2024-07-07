import type { Network } from "@wormhole-foundation/sdk-connect";
import { ChainContext, isNative, TokenAddress } from "@wormhole-foundation/sdk-connect";
import { CosmwasmAddress } from "./address.js";
import type { CosmwasmChains } from "./types.js";

export class CosmwasmChain<
  N extends Network = Network,
  C extends CosmwasmChains = CosmwasmChains,
> extends ChainContext<N, C> {
  override async getDecimals(token: TokenAddress<C>): Promise<number> {
    if (isNative(token)) return this.config.nativeTokenDecimals;

    const parsedToken = new CosmwasmAddress(token);
    if (parsedToken.denomType === "ibc") {
      const ibcBridge = await this.getIbcBridge();
      const gatewayAsset = await ibcBridge.getGatewayAsset(token);
      return this.platform.getChain("Wormchain").getDecimals(gatewayAsset);
    }

    return super.getDecimals(token);
  }
}
