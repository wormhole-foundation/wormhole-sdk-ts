import { SuiAddress } from './../../src/index.js';
import { SUI_COIN } from '../../src/constants.js';

describe("Sui Address Tests", () => {
  describe("Parse Address", () => {
    test("An address parses", () => {
      let address = new SuiAddress(SUI_COIN);
      expect(address).toBeTruthy();
      expect(address.toString()).toEqual(
        "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
      );

      const acctAddress = "0xc90949fd7ff3c13fd0b586a10547b5ca1212edc2c170e368d1dea00c01fea62b";
      address = new SuiAddress(acctAddress);
      expect(address).toBeTruthy();
      expect(address.toString()).toEqual(acctAddress);
    });

    test("An invalid address is rejected", () => {
      expect(() => new SuiAddress("bogus")).toThrow();
    });
  });
});
