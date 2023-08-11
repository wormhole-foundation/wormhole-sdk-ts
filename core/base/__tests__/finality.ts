import { finalityThreshold } from "../src/constants/finality";

describe("Finality tests", function () {
  const mainnetFinality = finalityThreshold("Mainnet");
  it("should correctly access values", function () {
    expect(mainnetFinality.Ethereum).toEqual(64);
  });
});
