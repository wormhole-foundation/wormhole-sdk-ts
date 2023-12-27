import { AlgorandAddress } from "../../src";

describe("Algorand Address Tests", () => {
  describe("Parse Address", () => {
    test("An address parses", () => {
      let address = new AlgorandAddress(
        "6XHBAFTDDSGTD4AOR67SLCCY7HAQGYBUWCVP2DYPIE7HI7G7IPNOEYM6XE",
      );
      expect(address).toBeTruthy();
    });

    test("An invalid address is rejected", () => {
      expect(() => new AlgorandAddress("bogusybogusybogus")).toThrow();
    });
  });
});
