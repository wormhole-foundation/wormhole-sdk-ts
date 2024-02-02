import { describe } from "@jest/globals";
import { platform } from "@wormhole-foundation/sdk-base";
import { testing } from "@wormhole-foundation/sdk-definitions";
import { Wormhole, networkPlatformConfigs } from "../src";
import { RouteTransferRequest } from "../src/routes";

const network: "Testnet" = "Testnet";
type TNet = typeof network;
const allPlatformCtrs = platform.platforms.map((p) =>
  testing.mocks.mockPlatformFactory(p, networkPlatformConfigs(network, p)),
);

async function createRequest(wh: Wormhole<TNet>): Promise<RouteTransferRequest<TNet>> {
  const fromChain = wh.getChain("Solana");
  const toChain = wh.getChain("Ethereum");

  const req = {
    from: testing.utils.makeUniversalChainAddress("Solana"),
    to: testing.utils.makeUniversalChainAddress("Ethereum"),
    source: testing.utils.makeUniversalChainAddress("Solana"),
    destination: testing.utils.makeUniversalChainAddress("Ethereum"),
  };
  return RouteTransferRequest.create(wh, req, fromChain, toChain);
}

describe("Wormhole Tests", () => {
  let wh: Wormhole<TNet>;
  beforeEach(() => {
    wh = new Wormhole(network, allPlatformCtrs);
  });

  test("nothing", () => {
    expect(1).toBe(1);
  });
  // test("Creates route resolver", async () => {
  //   const r: RouteResolver<TNet> = wh.resolver([ManualMockRoute, AutomaticMockRoute]);
  //   const req = await createRequest(wh);
  //   const routes = await r.findRoutes(req);
  //   expect(routes).toHaveLength(2);
  // });
});
