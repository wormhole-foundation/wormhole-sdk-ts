import { finalityThreshold, consistencyLevelToBlock } from "../src/constants/finality";

describe("Finality tests", function () {

  test("Accesses number of rounds", () => {
    expect(finalityThreshold("Ethereum")).toEqual(64);
    expect(finalityThreshold("Algorand")).toEqual(0);
    expect(finalityThreshold("Solana")).toEqual(32);
  })

  const fromBlock = 100n;

  const instantLevel = 200;
  test("Estimates rounds from instant consistency level", () => {
    expect(consistencyLevelToBlock("Algorand", fromBlock, instantLevel)).toEqual(100n);
    expect(consistencyLevelToBlock("Solana", fromBlock, instantLevel)).toEqual(100n);
    expect(consistencyLevelToBlock("Terra", fromBlock, instantLevel)).toEqual(100n);
  })

  const safeLevel = 201;
  test("Estimates rounds from safe consistency level", () => {
    // 100 + (32 - (100 % 32))
    expect(consistencyLevelToBlock("Ethereum", fromBlock, safeLevel)).toEqual(128n);
    // 100 + consistency level as rounds 
    expect(consistencyLevelToBlock("Bsc", fromBlock, safeLevel)).toEqual(301n);
    // 100 + 0 (instant)
    expect(consistencyLevelToBlock("Algorand", fromBlock, safeLevel)).toEqual(100n);
  })

  const finalizedLevel = 1;
  test("Estimates rounds from finalized consistency level", () => {
    // 100 + (# final rounds)
    expect(consistencyLevelToBlock("Ethereum", fromBlock, finalizedLevel)).toEqual(164n);
    expect(consistencyLevelToBlock("Solana", fromBlock, finalizedLevel)).toEqual(132n);
    // 100 + 0 (instant)
    expect(consistencyLevelToBlock("Algorand", fromBlock, finalizedLevel)).toEqual(100n);
    // L2 required
    expect(consistencyLevelToBlock("Polygon", fromBlock, finalizedLevel)).toEqual(612n);
  })

});

