import * as _solana from "@wormhole-foundation/sdk-solana";
import type { PlatformDefinition } from "../index.js";
/** Platform and protocol definitons for Solana */
const solana: PlatformDefinition<"Solana"> = {
  Address: _solana.SolanaAddress,
  Platform: _solana.SolanaPlatform,
  getSigner: _solana.getSolanaSignAndSendSigner,
  protocols: {
    WormholeCore: () => import("@wormhole-foundation/sdk-solana-core"),
    TokenBridge: () => import("@wormhole-foundation/sdk-solana-tokenbridge"),
    CircleBridge: () => import("@wormhole-foundation/sdk-solana-cctp"),
  },
  getChain: (n, c) => new _solana.SolanaChain(c, new _solana.SolanaPlatform(n)),
};
export default solana;
