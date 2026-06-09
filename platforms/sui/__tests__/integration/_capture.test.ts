import { describe, test } from "@jest/globals";
import { CONFIG } from "@wormhole-foundation/sdk-connect";
import { SuiPlatform } from "./../../src/index.js";
import { getTokenCoinType } from "@wormhole-foundation/sdk-sui-tokenbridge";
import "@wormhole-foundation/sdk-sui-core";
import "@wormhole-foundation/sdk-sui-tokenbridge";

/**
 * SKIPPED capture utility — documents how the expected values in coreBridge.test.ts
 * and tokenBridge.methods.test.ts were obtained from live mainnet. Run manually
 * (`describe.skip` → `describe.only`) to re-capture if the SDK or chain state changes.
 * Not part of the regular suite (would hit live network).
 *
 * The WormholeMessage tx (coreBridge.test.ts) was captured from a recent
 * `publish_message::WormholeMessage` event on mainnet; its digest + parsed
 * emitter/sequence are immutable and hardcoded in that test.
 */

const configs = CONFIG.Mainnet.chains;
const TOKEN_BRIDGE_STATE = "0xc57508ee0d4595e5a8728974a4a93a787d38f339757230d441e895422c07aba9";

describe.skip("capture (manual)", () => {
  const p = new SuiPlatform("Mainnet", configs);
  const rpc = p.getRpc("Sui");

  test("getTokenCoinType for AVAX origin", async () => {
    const addr = Buffer.from("000000000000000000000000b31f66aa3c1e785363f0875a1b74e27b85fd66c7", "hex");
    const coinType = await getTokenCoinType(rpc, TOKEN_BRIDGE_STATE, new Uint8Array(addr), 6);
    console.log("AVAX_COIN_TYPE", coinType);
  }, 30000);
});
