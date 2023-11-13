import { CosmwasmAddress } from "../../src";

describe("Cosmwasm Address Tests", () => {
  describe("Parse Address", () => {
    test("An address parses", () => {
      let address = new CosmwasmAddress(
        "terra1c02vds4uhgtrmcw7ldlg75zumdqxr8hwf7npseuf2h58jzhpgjxsgmwkvk"
      );
      expect(address).toBeTruthy();

      address = new CosmwasmAddress(
        "xpla137w0wfch2dfmz7jl2ap8pcmswasj8kg06ay4dtjzw7tzkn77ufxqfw7acv"
      );
      expect(address).toBeTruthy();
    });

    test("An invalid address is rejected", () => {
      expect(() => new CosmwasmAddress("bogusybogusybogus")).toThrow();
    });
  });
});
