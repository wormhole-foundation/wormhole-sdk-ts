import { Chain, api, load, toChain, wormhole } from "@wormhole-foundation/sdk";

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
  "Pythnet",
  "Evmos",
  "Osmosis",
  "Kujira",
  "Klaytn",
  "Wormchain",
  "Near",
  "Sui",
  "Xpla",
  "Aptos",
  "Cosmoshub",
];

(async function () {
  const wh = await wormhole("Mainnet", load("Evm", "Solana", "Algorand", "Cosmwasm"));

  const hbc = await getHeartbeats(wh.config.api);
  for (const [chain, heights] of Object.entries(hbc)) {
    if (skipChains.includes(chain)) continue;

    try {
      const ctx = wh.getChain(chain as Chain);
      // ..
      await ctx.getRpc();
      const chainLatest = await ctx.getLatestBlock();
      const stats = getStats(Object.values(heights));
      console.log(chain, BigInt(chainLatest) - stats.quorum);
    } catch (e) {
      console.error(chain, e);
    }
  }
})();

async function getHeartbeats(apiUrl: string): Promise<HeightsByChain> {
  const hbs = await api.getGuardianHeartbeats(apiUrl);
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
