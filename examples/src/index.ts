import { Wormhole } from "@wormhole-foundation/connect-sdk";
// Platform specific packages
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { getStuff } from "./helpers";

function fmtForDisplay(
  value: bigint,
  actual_decimals: bigint,
  display_decimals: number
): number {
  const fixedPlace =
    value / 10n ** (actual_decimals - BigInt(display_decimals));
  return Number(fixedPlace) / 10 ** display_decimals;
}

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform]);

  // Grab a ChainContext
  const chain = wh.getChain("Ethereum");
  const { signer } = await getStuff(chain);

  const decimals = await wh.getDecimals(chain.chain, "native");
  const balance = await wh.getBalance(chain.chain, "native", signer.address());

  console.log(fmtForDisplay(balance!, decimals, 8));

  //const tb = chain.getTokenBridge();
  //const rpc = chain.getRpc() as ethers.JsonRpcProvider;

  //const txid =
  //  "0x4a2cad595038e496545dd3fd526874d91be3a5e9bfdfe6b78fafd6ffcdb9dbc8";
  //console.log(await chain.parseTransaction(txid));
  //
})();
