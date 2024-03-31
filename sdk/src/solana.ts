/// <reference path="../../platforms/solana/src/index.ts" />
import * as _solana from "@wormhole-foundation/sdk-solana";
import type { PlatformDefinition } from "./index.js";
/** Platform and protocol definitons for Solana */
const solana: PlatformDefinition<"Solana"> = {
  Address: _solana.SolanaAddress,
  Platform: _solana.SolanaPlatform,
  getSigner: _solana.getSolanaSignAndSendSigner,
  protocolLoaders: {
    core: () => import("@wormhole-foundation/sdk-solana-core"),
    tokenbridge: () => import("@wormhole-foundation/sdk-solana-tokenbridge"),
    cctp: () => import("@wormhole-foundation/sdk-solana-cctp"),
  },
};
export default solana;
