import { describe } from "@jest/globals";
import { platform } from "@wormhole-foundation/sdk-base";
import { testing } from "@wormhole-foundation/sdk-definitions";
import { makeUniversalChainAddress } from "@wormhole-foundation/sdk-definitions/src/testing/utils";
import { Wormhole, networkPlatformConfigs } from "../src";
import { RouteResolver, RouteTransferRequest } from "../src/routes";
import { AutomaticMockRoute, ManualMockRoute } from "./mocks/routes/";

const network: "Testnet" = "Testnet";
type TNet = typeof network;
const allPlatformCtrs = platform.platforms.map((p) =>
  testing.mocks.mockPlatformFactory(p, networkPlatformConfigs(network, p)),
);

async function createRequest(wh: Wormhole<TNet>): Promise<RouteTransferRequest<TNet>> {
  const fromChain = wh.getChain("Solana");
  const toChain = wh.getChain("Ethereum");

  const req = {
    from: makeUniversalChainAddress("Solana"),
    to: makeUniversalChainAddress("Ethereum"),
    source: Wormhole.tokenId("Solana", "native"),
    destination: Wormhole.tokenId("Ethereum", "native"),
  };
  return RouteTransferRequest.create(wh, req, fromChain, toChain);
}

describe("Wormhole Tests", () => {
  let wh: Wormhole<TNet>;
  beforeEach(() => {
    wh = new Wormhole(network, allPlatformCtrs);
  });

  test("nothing", () => {
    expect(true).toBe(true);
  });
  test("Creates route resolver", async () => {
    const r: RouteResolver<TNet> = wh.resolver([ManualMockRoute, AutomaticMockRoute]);
    const req = await createRequest(wh);
    const routes = await r.findRoutes(req);
    expect(routes).toHaveLength(2);
  });
});
