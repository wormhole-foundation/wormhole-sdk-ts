import { describe, expect, test } from "@jest/globals";
import type { Chain } from "@wormhole-foundation/sdk-base";
import { platform } from "@wormhole-foundation/sdk-base";
import type { ChainContext, TokenId } from "@wormhole-foundation/sdk-definitions";
import { mocks } from "@wormhole-foundation/sdk-definitions/testing";
import { Wormhole, networkPlatformConfigs } from "./../src/index.js";
import { TBTCRoute } from "./../src/routes/index.js";

const network = "Mainnet" as const;
const allPlatformCtrs = platform.platforms.map((p) =>
  mocks.mockPlatformFactory(p, networkPlatformConfigs(network, p)),
);

const ctx = (chain: Chain) => ({ chain }) as unknown as ChainContext<typeof network>;
// Not inspected for exit-only destinations, which are rejected before any lookup
const ethTbtc = { chain: "Ethereum" } as unknown as TokenId;

describe("TBTCRoute exit-only chains", () => {
  test.each(["Optimism", "Polygon"] as const)("%s is exit-only", (chain) => {
    expect(TBTCRoute.isExitOnlyChain(chain)).toBe(true);
  });

  test.each(["Ethereum", "Arbitrum", "Base", "Solana"] as const)("%s is not exit-only", (chain) => {
    expect(TBTCRoute.isExitOnlyChain(chain)).toBe(false);
  });

  test.each(["Optimism", "Polygon"] as const)(
    "no destination tokens are offered on %s",
    async (chain) => {
      const tokens = await TBTCRoute.supportedDestinationTokens(
        ethTbtc,
        ctx("Ethereum"),
        ctx(chain),
      );
      expect(tokens).toEqual([]);
    },
  );

  test.each(["Optimism", "Polygon"] as const)(
    "validate rejects %s as destination",
    async (chain) => {
      const route = new TBTCRoute(new Wormhole(network, allPlatformCtrs));
      const request = { fromChain: ctx("Ethereum"), toChain: ctx(chain) } as any;
      const result = await route.validate(request, { amount: "1" });
      expect(result.valid).toBe(false);
      expect(result.valid === false && result.error.message).toContain("no longer supported");
    },
  );
});
