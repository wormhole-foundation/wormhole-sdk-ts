import * as _algorand from "@wormhole-foundation/connect-sdk-algorand";
import * as _algorand_core from "@wormhole-foundation/connect-sdk-algorand-core";
import * as _algorand_tokenbridge from "@wormhole-foundation/connect-sdk-algorand-tokenbridge";

export const algorand = {
  ...{
    Address: _algorand.AlgorandAddress,
    ChainContext: _algorand.AlgorandChain,
    Platform: _algorand.AlgorandPlatform,
    Signer: _algorand.AlgorandSigner,
  },
  protocols: {
    core: _algorand_core,
    tokenbridge: _algorand_tokenbridge,
  },
};
