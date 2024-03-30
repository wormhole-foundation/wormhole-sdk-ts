/// <reference path="../../platforms/evm/src/index.ts" />
import type { Network, PlatformDefinition } from "./index.js";
/** Platform and protocol definitions for Evm */
const evm = async <N extends Network>(): Promise<PlatformDefinition<N, "Evm">> => {
  const _evm = await import("@wormhole-foundation/sdk-evm");
  return {
    Address: _evm.EvmAddress,
    ChainContext: _evm.EvmChain<N>,
    Platform: _evm.EvmPlatform,
    // TODO: constrain these to network
    Signer: _evm.EvmNativeSigner,
    getSigner: _evm.getEvmSignerForKey,
    protocols: {
      core: () => import("@wormhole-foundation/sdk-evm-core"),
      tokenbridge: () => import("@wormhole-foundation/sdk-evm-tokenbridge"),
      portico: () => import("@wormhole-foundation/sdk-evm-portico"),
      cctp: () => import("@wormhole-foundation/sdk-evm-cctp"),
    },
    // @ts-ignore
    getSignerForSigner: _evm.getEvmSignerForSigner,
  };
};
export default evm;
