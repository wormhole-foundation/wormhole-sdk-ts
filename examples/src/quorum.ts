import { toChain } from "@wormhole-foundation/connect-sdk";
import { getGuardianHeartbeats } from "@wormhole-foundation/connect-sdk/src/whscan-api";

type Stats = {
  max: bigint;
  min: bigint;
  median: bigint;
  mean: bigint;
  delta: bigint;
};

type Status = {
  address: string;
  chainId: number;
  height: bigint;
};

(async function () {
  const hbs = await getGuardianHeartbeats();
  const nets = hbs
    ?.map((hb) => {
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

  const byChain: Record<string, Record<string, bigint>> = {};
  for (const status of nets!) {
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

  for (const [chain, heights] of Object.entries(byChain)) {
    const stats = getStats(Object.values(heights));
    console.log(chain, stats);
  }
})();

function getStats(vals: bigint[]): Stats {
  vals.sort();
  const max = vals[vals.length - 1]!;
  const min = vals[0]!;
  let sum = 0n;
  for (const v of vals) {
    sum += v;
  }
  const mean = sum / BigInt(vals.length);
  const median = vals[Math.floor(vals.length / 2)]!;
  return { max: max!, min: min!, median, mean, delta: max! - min! };
}
