/// <reference path="../../platforms/evm/src/index.ts" />
import type { Network, PlatformDefinition } from "./index.js";
/** Platform and protocol definitions for Evm */
const evm = async (): Promise<PlatformDefinition<Network, "Evm">> => {
  const _evm = await import("@wormhole-foundation/sdk-evm");
  return {
    Address: _evm.EvmAddress,
    ChainContext: _evm.EvmChain,
    Platform: _evm.EvmPlatform,
    Signer: _evm.EvmNativeSigner,
    getSigner: _evm.getEvmSignerForKey,
    protocols: {
      core: () => import("@wormhole-foundation/sdk-evm-core"),
      tokenbridge: () => import("@wormhole-foundation/sdk-evm-tokenbridge"),
      portico: () => import("@wormhole-foundation/sdk-evm-portico"),
      cctp: () => import("@wormhole-foundation/sdk-evm-cctp"),
      ntt: () => import("@wormhole-foundation/sdk-evm-ntt"),
    },
    // @ts-ignore
    getSignerForSigner: _evm.getEvmSignerForSigner,
  };
};
export default evm;
