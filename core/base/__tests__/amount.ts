import { baseUnits, displayAmount, Amount, parseAmount, truncateAmount, amountFromBaseUnits, scaleAmount } from "../src/";

describe("Amount Tests", function () {
  const parseCases: [number | string, number, Amount][] = [
    [4051.00, 18, { amount: '4051000000000000000000', decimals: 18 }],
    ['0.00000000000001', 14, { amount: '1', decimals: 14 }],
    ['000050', 2, { amount: '5000', decimals: 2 }],
    ['90.9999', 4, { amount: '909999', decimals: 4 }],
    ['0', 14, { amount: '0', decimals: 14 }],
    [10.0005, 6, { amount: '10000500', decimals: 6 }],
    ['00000010.5', 2, { amount: '1050', decimals: 2 }],
    ['00000010.55000000', 2, { amount: '1055', decimals: 2 }],
  ];

  it("should parse a number or string value", function () {
    for (const [input, decimals, expected] of parseCases) {
      expect(parseAmount(input, decimals)).toEqual(expected)
    }
  });

  it("rejects invalid parse requests", function () {
    expect(() => { parseAmount('405.22', 1) }).toThrow(); // Inadequate decimals
    expect(() => { parseAmount(NaN, 18) }).toThrow();     // Invalid inputs:
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

  const truncateCases: [Amount, number, Amount][] = [
    [ amountFromBaseUnits(1234n, 4), 2, amountFromBaseUnits(1200n, 4) ], // Loses last two digits
    [ amountFromBaseUnits(1234n, 4), 6, amountFromBaseUnits(1234n, 4) ], // Remains unchanged
  ];

  it("truncates amounts to a maximum decimal level", function () {
    for (const [input, decimals, expected] of truncateCases) {
      expect(truncateAmount(input, decimals)).toEqual(expected);
    }
  });

  const scaleCases: [Amount, number, Amount][] = [
    // 0.1234 can be scaled up to 0.12340000 without altering the value
    [ amountFromBaseUnits(0n, 4), 8, amountFromBaseUnits(0n, 8) ],
    [ amountFromBaseUnits(1234n, 4), 8, amountFromBaseUnits(12340000n, 8) ],
    // 12.30 can be scaled down to 12.3 without altering the value
    [ amountFromBaseUnits(1230n, 2), 1, amountFromBaseUnits(123n, 1) ],
    // 1000.0001 can be scaled up to 1000.000100 without altering the value
    [ amountFromBaseUnits(10000001n, 4), 6, amountFromBaseUnits(1000000100n, 6) ],
  ];

 it("scales amounts to a given decimal level", function () {
    for (const [input, decimals, expected] of scaleCases) {
      expect(scaleAmount(input, decimals)).toEqual(expected);
    }
  });

  const invalidScaleCases: [Amount, number][] = [
    // Can't scale 1234.5678 down to just 1234.56 because it alters the amount
    [ amountFromBaseUnits(12345678n, 4), 2 ],
    // Can't scale 0.12 down to just 0.1 because it alters the amount
    [ amountFromBaseUnits(12n, 2), 1 ],
    // Can't scale 1200.0101 down to just 1200.01 because it alters the amount
    [ amountFromBaseUnits(12000101n, 4), 2 ]
  ];

 it("refuses to scale where that alters the amount", function () {
    for (const [input, decimals] of invalidScaleCases) {
      expect(() => { scaleAmount(input, decimals) }).toThrow()
    }
  });
});
