import { parseBalance } from "../utils.js";

describe("utils", () => {
  describe("parseBalance()", () => {
    describe("valid inputs", () => {
      it("should parse decimal string", () => {
        const result = parseBalance("100");
        expect(result).not.toBeNull();
        expect(result!.toString()).toBe("100");
      });

      it("should parse hex string with 0x prefix", () => {
        const result = parseBalance("0x64");
        expect(result).not.toBeNull();
        expect(result!.toString()).toBe("100");
      });

      it("should parse full-length hex balance from Alchemy", () => {
        const result = parseBalance(
          "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
        );
        expect(result).not.toBeNull();
        expect(result!.toString()).toBe("1000000000000000000");
      });

      it("should parse string with leading/trailing whitespace", () => {
        const result = parseBalance("  123  ");
        expect(result).not.toBeNull();
        expect(result!.toString()).toBe("123");
      });

      it("should parse zero as decimal", () => {
        const result = parseBalance("0");
        expect(result).not.toBeNull();
        expect(result!.toString()).toBe("0");
      });

      it("should parse large balance value", () => {
        const result = parseBalance("1000000000000000000");
        expect(result).not.toBeNull();
        expect(result!.toString()).toBe("1000000000000000000");
      });

      it("should parse hex zero", () => {
        const result = parseBalance("0x0");
        expect(result).not.toBeNull();
        expect(result!.toString()).toBe("0");
      });
    });

    describe("edge cases", () => {
      it("should return null for empty string", () => {
        expect(parseBalance("")).toBe(null);
      });

      it("should return 0n for 0x alone", () => {
        const result = parseBalance("0x");
        expect(result).not.toBeNull();
        expect(result!.toString()).toBe("0");
      });

      it("should return 0n for string with only whitespace", () => {
        const result = parseBalance("   ");
        expect(result).not.toBeNull();
        expect(result!.toString()).toBe("0");
      });
    });

    describe("invalid inputs that return null", () => {
      it("should return null for undefined", () => {
        expect(parseBalance(undefined)).toBe(null);
      });

      it("should return null for invalid hex string", () => {
        expect(parseBalance("invalid_hex")).toBe(null);
      });

      it("should return null for non-numeric string", () => {
        expect(parseBalance("not a number")).toBe(null);
      });
    });
  });
});
