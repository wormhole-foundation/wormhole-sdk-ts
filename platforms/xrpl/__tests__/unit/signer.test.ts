import { Wallet } from "xrpl";
import { XrplSigner } from "../../src/signer.js";

const TEST_SEED = "sEdTM1uX8pu2do5XvTnutH6HsouMaM2";
const expectedWallet = Wallet.fromSeed(TEST_SEED);

describe("XrplSigner — unit (no RPC)", () => {
  it("derives the correct classic address from seed", () => {
    const signer = new XrplSigner("Xrpl", "Testnet", {} as any, TEST_SEED);
    expect(signer.address()).toBe(expectedWallet.classicAddress);
  });

  it("chain() returns the chain passed to the constructor", () => {
    const signer = new XrplSigner("Xrpl", "Testnet", {} as any, TEST_SEED);
    expect(signer.chain()).toBe("Xrpl");
  });

  it("address() returns a valid r-address", () => {
    const signer = new XrplSigner("Xrpl", "Testnet", {} as any, TEST_SEED);
    expect(signer.address()).toMatch(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/);
  });
});
