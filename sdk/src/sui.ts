import * as _sui from "@wormhole-foundation/sdk-sui";
import * as _sui_core from "@wormhole-foundation/sdk-sui-core";
import * as _sui_tokenbridge from "@wormhole-foundation/sdk-sui-tokenbridge";

export const sui = {
  ...{
    Address: _sui.SuiAddress,
    ChainContext: _sui.SuiChain,
    Platform: _sui.SuiPlatform,
    Signer: _sui.SuiSigner,
  },
  protocols: {
    core: _sui_core,
    tokenbridge: _sui_tokenbridge,
  },
};
