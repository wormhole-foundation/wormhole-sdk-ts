import { describe, expect, test } from "@jest/globals";
import { amount } from "@wormhole-foundation/sdk-base";
import { TokenTransfer } from "../src/protocols/tokenBridge/tokenTransfer.js";

describe("TokenTransfer", () => {
  describe("calculateReferrerFee", () => {
    test("should calculate referrer fee correctly with 18 decimals and 100 dBps", () => {
      // 1.5 ETH with 18 decimals
      const amt = amount.fromBaseUnits(1500000000000000000n, 18);
      const dBps = 100n; // 0.1% fee

      const result = TokenTransfer.calculateReferrerFee(amt, dBps);

      // Expected fee: 1.5 ETH * 0.1% = 0.0015 ETH
      expect(amount.units(result.fee)).toBe(1500000000000000n);
      expect(result.fee.decimals).toBe(18);

      // Expected remaining: 1.5 ETH - 0.0015 ETH = 1.4985 ETH
      expect(amount.units(result.remaining)).toBe(1498500000000000000n);
      expect(result.remaining.decimals).toBe(18);

      // Verify the fee + remaining equals the original amount
      expect(amount.units(result.fee) + amount.units(result.remaining)).toBe(amount.units(amt));
    });

    test("should return correct Amount objects with preserved decimals", () => {
      const amt = amount.fromBaseUnits(1000000000000000000n, 18); // 1 ETH
      const dBps = 1000n; // 1% fee

      const result = TokenTransfer.calculateReferrerFee(amt, dBps);

      // Check that both results are proper Amount objects
      expect(result.fee).toHaveProperty("amount");
      expect(result.fee).toHaveProperty("decimals");
      expect(result.remaining).toHaveProperty("amount");
      expect(result.remaining).toHaveProperty("decimals");

      // Check decimals are preserved
      expect(result.fee.decimals).toBe(18);
      expect(result.remaining.decimals).toBe(18);
    });

    test("should handle zero fee correctly", () => {
      const amt = amount.fromBaseUnits(1000000000000000000n, 18); // 1 ETH
      const dBps = 0n;

      const result = TokenTransfer.calculateReferrerFee(amt, dBps);

      expect(amount.units(result.fee)).toBe(0n);
      expect(amount.units(result.remaining)).toBe(1000000000000000000n);
      expect(result.remaining).toEqual(amt);
    });

    test("should handle maximum dBps (65535)", () => {
      const amt = amount.fromBaseUnits(1000000000000000000n, 18); // 1 ETH
      const dBps = 65535n; // Maximum value (65.535%)

      const result = TokenTransfer.calculateReferrerFee(amt, dBps);

      // Expected fee: 1 ETH * 65.535% = 0.65535 ETH
      expect(amount.units(result.fee)).toBe(655350000000000000n);

      // Expected remaining: 1 ETH - 0.65535 ETH = 0.34465 ETH
      expect(amount.units(result.remaining)).toBe(344650000000000000n);
    });

    test("should throw error for dBps exceeding max u16", () => {
      const amt = amount.fromBaseUnits(1000000000000000000n, 18);
      const dBps = 65536n; // Exceeds max u16

      expect(() => TokenTransfer.calculateReferrerFee(amt, dBps)).toThrow("dBps exceeds max u16");
    });

    test("should handle USDC (6 decimals) correctly", () => {
      // 100 USDC with 6 decimals
      const amt = amount.fromBaseUnits(100000000n, 6);
      const dBps = 250n; // 0.25% fee

      const result = TokenTransfer.calculateReferrerFee(amt, dBps);

      // Expected fee: 100 USDC * 0.25% = 0.25 USDC
      expect(amount.units(result.fee)).toBe(250000n);
      expect(result.fee.decimals).toBe(6);

      // Expected remaining: 100 USDC - 0.25 USDC = 99.75 USDC
      expect(amount.units(result.remaining)).toBe(99750000n);
      expect(result.remaining.decimals).toBe(6);
    });

    test("should handle small amounts correctly", () => {
      // 0.000001 ETH with 18 decimals
      const amt = amount.fromBaseUnits(1000000000000n, 18);
      const dBps = 100n; // 0.1% fee

      const result = TokenTransfer.calculateReferrerFee(amt, dBps);

      // Expected fee: 0.000001 ETH * 0.1% = 0.000000001 ETH
      expect(amount.units(result.fee)).toBe(1000000000n);

      // Expected remaining: 0.000001 ETH - 0.000000001 ETH
      expect(amount.units(result.remaining)).toBe(999000000000n);
    });

    test("should handle 10% fee (10000 dBps)", () => {
      const amt = amount.fromBaseUnits(1000000n, 6); // 1 USDC
      const dBps = 10000n; // 10% fee

      const result = TokenTransfer.calculateReferrerFee(amt, dBps);

      // Expected fee: 1 USDC * 10% = 0.1 USDC
      expect(amount.units(result.fee)).toBe(100000n);

      // Expected remaining: 1 USDC - 0.1 USDC = 0.9 USDC
      expect(amount.units(result.remaining)).toBe(900000n);
    });

    test("should handle very small dBps values", () => {
      const amt = amount.fromBaseUnits(1000000000000000000n, 18); // 1 ETH
      const dBps = 1n; // 0.001% fee

      const result = TokenTransfer.calculateReferrerFee(amt, dBps);

      // Expected fee: 1 ETH * 0.001% = 0.00001 ETH
      expect(amount.units(result.fee)).toBe(10000000000000n);

      // Expected remaining: 1 ETH - 0.00001 ETH
      expect(amount.units(result.remaining)).toBe(999990000000000000n);
    });
  });
});
