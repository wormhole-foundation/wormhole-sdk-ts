import { Chain, Wormhole, api, toChain, wormhole } from "@wormhole-foundation/sdk";
import { algorand } from "@wormhole-foundation/sdk/algorand";
import { cosmwasm } from "@wormhole-foundation/sdk/cosmwasm";
import { evm } from "@wormhole-foundation/sdk/evm";
import { solana } from "@wormhole-foundation/sdk/solana";
import { sui } from "@wormhole-foundation/sdk/sui";
import { aptos } from "@wormhole-foundation/sdk/aptos";

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

const skipChains: Chain[] = [
  // Not supported
  "Pythnet",
  // Gateway chains,
  // not tracked individually
  "Evmos",
  "Osmosis",
  "Kujira",
  "Klaytn",
  "Xpla",
  "Cosmoshub",
  "Neutron",
  "Stargaze",
  "Sei",
  "Dymension",
  "Celestia",
  //
  "Near",
];

(async function () {
  const wh = await wormhole("Mainnet", [evm, solana, cosmwasm, algorand, sui, aptos]);

  const hbc = await getHeartbeats(wh.config.api);

  await Promise.all(
    Object.entries(hbc)
      .filter(([chain, _]) => !skipChains.includes(chain as Chain))
      .map(([chain, heights]) => [chain, getStats(Object.values(heights))] as [Chain, Stats])
      .map(async ([chain, stats]) => {
        try {
          const ctx = wh.getChain(chain as Chain);
          const latestBlock = await ctx.getLatestBlock();
          const delta = Number(BigInt(latestBlock) - stats.quorum);
          const deltaSeconds = (ctx.config.blockTime * delta) / 1000;
          console.log(`${chain}: ${delta} (~${deltaSeconds}s)`);
        } catch (e) {
          console.error(chain, e);
        }
      }),
  );
})();

async function getHeartbeats(apiUrl: string): Promise<HeightsByChain> {
  const hbs = await api.getGuardianHeartbeats(apiUrl);
  const nets = hbs!
    .map((hb: { rawHeartbeat: { networks: any[] }; verifiedGuardianAddr: any }) => {
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
