import { XrplAddress, XrplZeroAddress } from "../../src/address.js";

describe("XRPL Address Tests", () => {
  const VALID_ADDRESS = "rDJeTzyYRtfDEojW9c9SDZWBHNarZbVVfN";

  it("Create address from string - unwrap", () => {
    const address = new XrplAddress(VALID_ADDRESS);
    expect(address.unwrap()).toBe(VALID_ADDRESS);
  });

  it("Create address from string - toString", () => {
    const address = new XrplAddress(VALID_ADDRESS);
    expect(address.toString()).toBe(VALID_ADDRESS);
  });

  it("Create zero address", () => {
    const address = new XrplAddress(XrplZeroAddress);
    expect(address.unwrap()).toBe(XrplZeroAddress);
  });

  it("toUniversalAddress produces 32 bytes", () => {
    const address = new XrplAddress(VALID_ADDRESS);
    const universal = address.toUniversalAddress();
    expect(universal.toUint8Array().length).toBe(32);
  });

  it("toUint8Array produces 20 bytes (account ID)", () => {
    const address = new XrplAddress(VALID_ADDRESS);
    const bytes = address.toUint8Array();
    expect(bytes.length).toBe(20);
  });

  it("round-trip: same address produces same universal", () => {
    const addr1 = new XrplAddress(VALID_ADDRESS);
    const addr2 = new XrplAddress(VALID_ADDRESS);
    expect(addr1.toUniversalAddress().equals(addr2.toUniversalAddress())).toBe(
      true,
    );
  });

  it("equals returns true for same address", () => {
    const addr1 = new XrplAddress(VALID_ADDRESS);
    const addr2 = new XrplAddress(VALID_ADDRESS);
    expect(addr1.equals(addr2)).toBe(true);
  });

  it("is valid address", () => {
    expect(XrplAddress.isValidAddress(VALID_ADDRESS)).toBe(true);
  });

  it("rejects invalid address", () => {
    expect(XrplAddress.isValidAddress("not-an-address")).toBe(false);
  });

  it("constructor throws for invalid address", () => {
    expect(() => new XrplAddress("invalid")).toThrow("Invalid XRPL address");
  });
});
