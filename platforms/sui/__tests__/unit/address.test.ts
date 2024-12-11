import { SuiAddress } from "./../../src/index.js";
import { SUI_COIN } from "../../src/constants.js";

describe("Sui Address Tests", () => {
  describe("Parse Address", () => {
    test("An address parses", () => {
      let address = new SuiAddress(SUI_COIN);
      expect(address).toBeTruthy();
      expect(address.toString()).toEqual(
        "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
      );
      expect(address.getCoinType()).toEqual(SUI_COIN);

      const acctAddress = "0xc90949fd7ff3c13fd0b586a10547b5ca1212edc2c170e368d1dea00c01fea62b";
      address = new SuiAddress(acctAddress);
      expect(address).toBeTruthy();
      expect(address.toString()).toEqual(acctAddress);

      const wrappedTokenAddress =
        "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN";
      address = new SuiAddress(wrappedTokenAddress);
      expect(address).toBeTruthy();
      expect(address.toString()).toEqual(wrappedTokenAddress);
      expect(address.getCoinType()).toEqual(wrappedTokenAddress);

      const nativeTokenAddress =
        "0xfa7ac3951fdca92c5200d468d31a365eb03b2be9936fde615e69f0c1274ad3a0::BLUB::BLUB";
      address = new SuiAddress(nativeTokenAddress);
      expect(address).toBeTruthy();
      expect(address.toString()).toEqual(nativeTokenAddress);
      expect(address.getCoinType()).toEqual(nativeTokenAddress);
    });

    test("An invalid address is rejected", () => {
      expect(() => new SuiAddress("bogus")).toThrow();
    });
  });
});
