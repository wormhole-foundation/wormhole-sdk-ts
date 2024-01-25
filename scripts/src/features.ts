import fs from "fs";
import {
  Chain,
  Network,
  Wormhole,
  chains,
  platformToChains,
} from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { CosmwasmPlatform } from "@wormhole-foundation/connect-sdk-cosmwasm";
import { AlgorandPlatform } from "@wormhole-foundation/connect-sdk-algorand";

import "@wormhole-foundation/connect-sdk-evm-core";
import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-evm-cctp";
import "@wormhole-foundation/connect-sdk-evm-portico";

import "@wormhole-foundation/connect-sdk-solana-core";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-cctp";

import "@wormhole-foundation/connect-sdk-cosmwasm-core";
import "@wormhole-foundation/connect-sdk-cosmwasm-tokenbridge";
import "@wormhole-foundation/connect-sdk-cosmwasm-ibc";

import "@wormhole-foundation/connect-sdk-algorand-core";
import "@wormhole-foundation/connect-sdk-algorand-tokenbridge";
import { platforms } from "@wormhole-foundation/sdk-base/src/constants/platforms";

type SupportedProtocols = Record<string, Record<string, boolean>>;

function supportedCheck(sp: SupportedProtocols, proto: string, chain: string): string {
  const supported = proto in sp && chain in sp[proto]! ? sp[proto]![chain] : false;
  return supported ? ":white_check_mark:" : ":no_entry_sign:";
}

(async function () {
  const supportedTestnetProtos = getSupportmatrix("Testnet");
  const supportedMainnetProtos = getSupportmatrix("Mainnet");

  const allProtos = Array.from(
    new Set([...Object.keys(supportedTestnetProtos), ...Object.keys(supportedMainnetProtos)]),
  );
  const tables = [];

  const mainnetSupported = getSupportTables(allProtos, supportedMainnetProtos);
  tables.push(`# Mainnet `);
  for (const [k, v] of Object.entries(mainnetSupported)) {
    tables.push(`
## ${k}

${v}
`);
  }

  const testnetSupported = getSupportTables(allProtos, supportedTestnetProtos);
  tables.push(`# Testnet `);
  for (const [k, v] of Object.entries(testnetSupported)) {
    tables.push(`
## ${k}

${v}
`);
  }

  fs.writeFileSync("SUPPORT_MATRIX.md", `${tables.join("\n")}`);
})();

function getSupportTables(protos: string[], supported: SupportedProtocols): Record<string, string> {
  const platformSupport: Record<string, string> = {};
  for (const platform of platforms) {
    const _chains = platformToChains(platform);
    const rows = ["| Chain | Route | Supported? |", "| -- | -- | -- |"];
    for (const chain of _chains) {
      for (const proto of protos) {
        const isSupported = supportedCheck(supported, proto, chain);
        rows.push(`| ${chain} | ${proto} | ${isSupported} |`);
      }
    }
    platformSupport[platform] = rows.join("\n");
  }
  return platformSupport;
}

function getSupportmatrix(n: Network) {
  // Setup
  const wh = new Wormhole(n, [EvmPlatform, SolanaPlatform, CosmwasmPlatform, AlgorandPlatform]);

  const resolver = wh.resolver();

  const protoSupport: SupportedProtocols = {};
  for (const rc of resolver.routeConstructors) {
    const name = rc.meta.name;
    protoSupport[name] = {};

    const chains = rc.supportedChains(wh.network);
    for (const chain of chains) {
      try {
        const ctx = wh.getChain(chain as Chain);
        protoSupport[name]![chain] = rc.isProtocolSupported(ctx);
      } catch (e) {
        console.log("error on: ", chain);
      }
    }
  }
  return protoSupport;
}
