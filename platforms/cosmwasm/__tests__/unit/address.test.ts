import { toNative } from "@wormhole-foundation/sdk-connect";
import { CosmwasmAddress } from "./../../src/index.js";

describe("Cosmwasm Address Tests", () => {
  describe("Parse Address", () => {
    test("An address parses", () => {
      let address = new CosmwasmAddress(
        "terra1c02vds4uhgtrmcw7ldlg75zumdqxr8hwf7npseuf2h58jzhpgjxsgmwkvk",
      );
      expect(address).toBeTruthy();

      address = new CosmwasmAddress(
        "xpla137w0wfch2dfmz7jl2ap8pcmswasj8kg06ay4dtjzw7tzkn77ufxqfw7acv",
      );
      expect(address).toBeTruthy();
    });

    test("An invalid address is rejected", () => {
      expect(() => new CosmwasmAddress("bogusybogusybogus")).toThrow();
    });
    test("A hex address gets the appropriate prefix", () => {
      const hexAddress = "0x017ce8aec5af3bb3ac0158d49771d4c8feba2e54a614fa2a1c0c95e9c4c37185";
      const address = toNative("Xpla", hexAddress);
      expect(address.toString()).toEqual(
        "xpla1q97w3tk94uam8tqptr2fwuw5erlt5tj55c2052supj27n3xrwxzsj3f2qj",
      );
    });
  });
});
