import { Chain, Wormhole, api, toChain } from "@wormhole-foundation/connect-sdk";
import { AlgorandPlatform } from "@wormhole-foundation/connect-sdk-algorand/src";
import { CosmwasmPlatform } from "@wormhole-foundation/connect-sdk-cosmwasm";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

type Stats = {
  max: bigint;
  min: bigint;
  quorum: bigint;
  mean: bigint;
  delta: bigint;
};

type Status = {
  address: string;
  chainId: number;
  height: bigint;
};

type HeightsByChain = Record<string, Record<string, bigint>>;

const skipChains = [
  "Terra",
  "Pythnet",
  "Evmos",
  "Injective",
  "Osmosis",
  "Terra2",
  "Kujira",
  "Klaytn",
  "Wormchain",
  "Near",
  "Sui",
  "Xpla",
  "Sei",
  "Aptos",
];

const dontSkipChains = ["Cosmoshub"];
(async function () {
  const wh = new Wormhole(
    "Mainnet",
    [EvmPlatform, SolanaPlatform, CosmwasmPlatform, AlgorandPlatform],
    {
      chains: {
        Cosmoshub: {
          rpc: "https://cosmos-rest.publicnode.com",
        },
      },
    },
  );

  const hbc = await getHeartbeats();
  for (const [chain, heights] of Object.entries(hbc)) {
    if (!dontSkipChains.includes(chain)) continue;
    try {
      const ctx = wh.getChain(chain as Chain);
      const r = await ctx.getRpc();
      console.log(r.forceGetCometClient());

      const chainLatest = await ctx.getLatestBlock();
      const stats = getStats(Object.values(heights));
      console.log(chain, BigInt(chainLatest) - stats.quorum);
    } catch (e) {
      console.error(chain, e);
    }
  }
})();

async function getHeartbeats(): Promise<HeightsByChain> {
  const hbs = await api.getGuardianHeartbeats();
  const nets = hbs!
    .map((hb) => {
      return hb.rawHeartbeat.networks
        .map((n) => {
          return {
            address: hb.verifiedGuardianAddr,
            chainId: n.id,
            height: BigInt(n.height),
          } as Status;
        })
        .flat();
    })
    .flat();

  const byChain: HeightsByChain = {};
  for (const status of nets) {
    // Jump
    if (status.address === "0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5") continue;

    let chain;
    try {
      chain = toChain(status.chainId);
    } catch {
      continue;
    }

    if (!(chain in byChain)) byChain[chain] = {};
    byChain[chain]![status.address] = status.height;
  }
  return byChain;
}

function getStats(vals: bigint[]): Stats {
  vals.sort();
  const max = vals[vals.length - 1]!;
  const min = vals[0]!;
  let sum = 0n;
  for (const v of vals) {
    sum += v;
  }
  const mean = sum / BigInt(vals.length);
  const quorum = vals[Math.floor(vals.length / 3) * 2]!;
  return { max: max!, min: min!, quorum, mean, delta: max! - min! };
}
