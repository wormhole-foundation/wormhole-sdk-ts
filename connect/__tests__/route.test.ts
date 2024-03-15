import { describe } from "@jest/globals";
import { platform } from "@wormhole-foundation/sdk-base";
import { mocks } from "@wormhole-foundation/sdk-definitions/testing";
import { Wormhole, networkPlatformConfigs } from "./../src/index.js";

const network: "Testnet" = "Testnet";
type TNet = typeof network;
const allPlatformCtrs = platform.platforms.map((p) =>
  mocks.mockPlatformFactory(p, networkPlatformConfigs(network, p)),
);

describe("Wormhole Tests", () => {
  let wh: Wormhole<TNet>;
  beforeEach(function () {
    wh = new Wormhole(network, allPlatformCtrs);
  });

  test("nothing", function () {
    console.log(wh.network);
    expect(1).toBe(1);
  });
  // test("Creates route resolver", async () => {
  //   const r: RouteResolver<TNet> = wh.resolver([ManualMockRoute, AutomaticMockRoute]);
  //   const req = await createRequest(wh);
  //   const routes = await r.findRoutes(req);
  //   expect(routes).toHaveLength(2);
  // });
});
