import { finalityThreshold } from "../src/constants/finality";
import {contracts} from "../src/constants";

describe("Finality tests", function () {
  const mainnetFinality = finalityThreshold("Mainnet", "Ethereum");
  it("should correctly access values", function () {
    expect(mainnetFinality).toEqual(64);
  });
});

