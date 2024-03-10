import { Network, PlatformDefinition } from ".";
import * as _aptos from "@wormhole-foundation/sdk-aptos";
/** Platform and protocol definitions for Aptos */
export const aptos: PlatformDefinition<Network, "Aptos"> = {
  Address: _aptos.AptosAddress,
  ChainContext: _aptos.AptosChain,
  Platform: _aptos.AptosPlatform,
  Signer: _aptos.AptosSigner,
  getSigner: _aptos.getAptosSigner,
  protocols: {
    core: () => import("@wormhole-foundation/sdk-aptos-core"),
    tokenbridge: () => import("@wormhole-foundation/sdk-aptos-tokenbridge"),
  },
};
