import { applyChainsConfigConfigOverrides } from "@wormhole-foundation/sdk-connect";
import * as _cosmwasm from "@wormhole-foundation/sdk-cosmwasm";
import type { PlatformDefinition } from "../index.js";
const cosmwasm: PlatformDefinition<typeof _cosmwasm._platform> = {
  Address: _cosmwasm.CosmwasmAddress,
  Platform: _cosmwasm.CosmwasmPlatform,
  getSigner: _cosmwasm.getCosmwasmSigner,
  protocols: {
    WormholeCore: () => import("@wormhole-foundation/sdk-cosmwasm-core"),
    TokenBridge: () => import("@wormhole-foundation/sdk-cosmwasm-tokenbridge"),
    IbcBridge: () => import("@wormhole-foundation/sdk-cosmwasm-ibc"),
  },
  getChain: (network, chain, overrides?) =>
    new _cosmwasm.CosmwasmChain(
      chain,
      new _cosmwasm.CosmwasmPlatform(
        network,
        applyChainsConfigConfigOverrides(network, _cosmwasm._platform, {
          [chain]: overrides,
        }),
      ),
    ),
};
export default cosmwasm;
