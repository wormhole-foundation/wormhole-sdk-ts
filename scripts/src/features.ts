import fs from "fs";
import { Chain, Network, Wormhole, chains } from "@wormhole-foundation/sdk-connect";
import { EvmPlatform } from "@wormhole-foundation/sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/sdk-solana";
import { CosmwasmPlatform } from "@wormhole-foundation/sdk-cosmwasm";
import { AlgorandPlatform } from "@wormhole-foundation/sdk-algorand";

import "@wormhole-foundation/sdk-evm-core";
import "@wormhole-foundation/sdk-evm-tokenbridge";
import "@wormhole-foundation/sdk-evm-cctp";
import "@wormhole-foundation/sdk-evm-portico";

import "@wormhole-foundation/sdk-solana-core";
import "@wormhole-foundation/sdk-solana-tokenbridge";
import "@wormhole-foundation/sdk-solana-cctp";

import "@wormhole-foundation/sdk-cosmwasm-core";
import "@wormhole-foundation/sdk-cosmwasm-tokenbridge";
import "@wormhole-foundation/sdk-cosmwasm-ibc";

import "@wormhole-foundation/sdk-algorand-core";
import "@wormhole-foundation/sdk-algorand-tokenbridge";

type SupportedProtocols = Record<string, Record<string, boolean>>;

function supportedCheck(sp: SupportedProtocols, proto: string, chain: string): string {
  const supported = proto in sp && chain in sp[proto]! ? sp[proto]![chain] : false;
  return supported ? ":white_check_mark:" : ":no_entry_sign:";
}

(async function () {
  const supportedTestnetProtos = getSupportmatrix("Testnet");
  const supportedMainnetProtos = getSupportmatrix("Mainnet");

  const allProtos = new Set([
    ...Object.keys(supportedTestnetProtos),
    ...Object.keys(supportedMainnetProtos),
  ]);

  const rows = ["| Chain | Route | Mainnet | Testnet |", "| -- | -- | -- | -- |"];
  for (const chain of chains) {
    for (const proto of allProtos) {
      const mainnetSupported = supportedCheck(supportedMainnetProtos, proto, chain);
      const testnetSupported = supportedCheck(supportedTestnetProtos, proto, chain);

      rows.push(`| ${chain} | ${proto} | ${mainnetSupported} | ${testnetSupported} |`);
    }
  }
  const supportTable = rows.join("\n");
  fs.writeFileSync("SUPPORT_MATRIX.md", supportTable);
})();

function getSupportmatrix(n: Network) {
  // Setup
  const wh = new Wormhole(n, [EvmPlatform, SolanaPlatform, CosmwasmPlatform, AlgorandPlatform]);

  const resolver = wh.resolver([]);

  const protoSupport: SupportedProtocols = {};
  for (const rc of resolver.routeConstructors) {
    const name = rc.meta.name;
    protoSupport[name] = {};

    const chains = rc.supportedChains(wh.network);
    for (const chain of chains) {
      try {
        const ctx = wh.getChain(chain as Chain);
        protoSupport[name]![chain] = rc.supportedChains(ctx.network).includes(ctx.chain);
      } catch (e) {
        console.log("error on: ", chain);
      }
    }
  }
  return protoSupport;
}
