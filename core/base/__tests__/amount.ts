import { normalizeAmount, amount, baseUnits, displayAmount, Amount } from "../src/";

describe("Amount Tests", function () {
  // amt, decimals, expected
  const cases: [number | string, bigint, bigint][] = [
    [1, 18n, BigInt(1 + "0".repeat(18))],
    [0, 18n, BigInt(0)],
    [1, 2n, BigInt(1 + "0".repeat(2))],
    [3.2, 2n, BigInt(320)],
    ["1.4", 12n, BigInt(1400000000000)],
    ["0.0001", 12n, BigInt(100000000)],
    ["0", 2n, BigInt(0)],
    // should we throw on negative?
    [-3, 2n, BigInt(-300)],
    ["-3", 2n, BigInt(-300)],
    [1, 0n, BigInt(1)],
    ["1", 0n, BigInt(1)],
    ["1.0", 1n, BigInt(10)],
  ];

  const badCases: [number | string, bigint][] = [
    ["0.000001", 2n],
    ["-0.000001", 2n],
    ["3", -2n],
  ];

  it("should correctly normalize values", function () {
    for (const [amt, dec, expected] of cases) {
      const actual = normalizeAmount(amt, dec);
      expect(actual).toEqual(expected);
    }
  });

  it("should correctly fail on unexpected values", function () {
    for (const [amt, dec] of badCases) {
      const actual = () => normalizeAmount(amt, dec);
      expect(actual).toThrow();
    }
  });


  const parseCases: [number | string, number, Amount][] = [
    [4051.00, 18, { amount: '4051000000000000000000', decimals: 18 }],
    ['0.00000000000001', 14, { amount: '1', decimals: 14 }],
    ['000050', 2, { amount: '5000', decimals: 2 }],
    ['90.9999', 4, { amount: '909999', decimals: 4 }],
    ['0', 14, { amount: '0', decimals: 14 }],
    [10.0005, 6, { amount: '10000500', decimals: 6 }],
  ];

  it("should parse a number or string value", function () {
    for (const [input, decimals, expected] of parseCases) {
      expect(parseAmount(input, decimals)).toEqual(expected)
    }
  });

  it("rejects invalid parse requests", function () {
    expect(() => { parseAmount(NaN, 18) }).toThrow();
    expect(() => { parseAmount(Infinity, 18) }).toThrow();
    expect(() => { parseAmount(-Infinity, 18) }).toThrow();
    expect(() => { parseAmount('milady', 18) }).toThrow();
    expect(() => { parseAmount('405.X', 18) }).toThrow();
    expect(() => { parseAmount('405.0', NaN) }).toThrow();
  });

  const baseUnitCases: [Amount, bigint][] = [
    [{ amount: '0', decimals: 0 }, 0n],
    [{ amount: '1', decimals: 18 }, 1n],
    [{ amount: '50', decimals: 2 }, 50n],
    [{ amount: '10', decimals: 0 }, 10n],
    [{ amount: '55', decimals: 4 }, 55n],
  ];

  const invalidAmounts: Amount[] = [
    { amount: '4.5', decimals: 2 },
    { amount: 'milady', decimals: 2 },
    { amount: '456821', decimals: -2 },
    { amount: '456821', decimals: Infinity },
    { amount: '456821', decimals: -Infinity },
    { amount: '456821', decimals: NaN },
  ]

  it("should convert Amounts to base units as bigint", function () {
    for (const [input, expected] of baseUnitCases) {
      expect(baseUnits(input)).toEqual(expected);
    }
  });

  it("should reject invalid baseUnit requests", function () {
    for (const amount of invalidAmounts) {
      expect(() => { baseUnits(amount) }).toThrow();
    }
  });

  const displayCases: [Amount, number | undefined, string][] = [
    [{ amount: '1', decimals: 18 }, undefined, '0.000000000000000001'],
    [{ amount: '1', decimals: 18 }, 0, '0.000000000000000001'],
    [{ amount: '5020', decimals: 2 }, 0, '50.20'],
    [{ amount: '5020', decimals: 2 }, 4, '50.2000'],
    [{ amount: '5020', decimals: 2 }, undefined, '50.20'],
    [{ amount: '1', decimals: 0 }, 0, '1'],
  ];

  it("displays an Amount as a string", function () {
    for (const [input, decimals, expected] of displayCases) {
      expect(displayAmount(input, decimals)).toEqual(expected);
    }
  });

  it("rejects invalid displayAmount requests", function () {
    for (const amount of invalidAmounts) {
      expect(() => { displayAmount(amount, 2) }).toThrow();
    }

    // displayAmount cannot fail otherwise; but sometimes precision might be ignored if it's invalid
  });
});
