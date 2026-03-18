import { XrplAddress, XrplZeroAddress } from "../../src/address.js";

describe("XRPL Address Tests", () => {
  const VALID_ADDRESS = "rDJeTzyYRtfDEojW9c9SDZWBHNarZbVVfN";

  it("constructor preserves address string", () => {
    const address = new XrplAddress(VALID_ADDRESS);
    expect(address.unwrap()).toBe(VALID_ADDRESS);
    expect(address.toString()).toBe(VALID_ADDRESS);
  });

  it("constructor accepts the zero (black-hole) address", () => {
    const address = new XrplAddress(XrplZeroAddress);
    expect(address.unwrap()).toBe(XrplZeroAddress);
  });

  it("copy constructor preserves address and format", () => {
    const original = new XrplAddress(VALID_ADDRESS);
    const copy = new XrplAddress(original);
    expect(copy.toString()).toBe(VALID_ADDRESS);
    expect(copy.format).toBe("account");
  });

  it("toUint8Array produces the correct 20-byte account ID", () => {
    const address = new XrplAddress(VALID_ADDRESS);
    const bytes = address.toUint8Array();
    expect(bytes.length).toBe(20);
    // Verified via: xrpl.decodeAccountID("rDJeTzyYRtfDEojW9c9SDZWBHNarZbVVfN")
    expect(Buffer.from(bytes).toString("hex")).toBe(
      "86f7dafabaacec5c69bf66611f5449a4251a7525",
    );
  });

  it("toUniversalAddress left-zero-pads account ID to 32 bytes", () => {
    const address = new XrplAddress(VALID_ADDRESS);
    const universal = address.toUniversalAddress();
    const bytes = universal.toUint8Array();
    expect(bytes.length).toBe(32);
    // First 12 bytes should be zero padding
    expect(bytes.slice(0, 12)).toEqual(new Uint8Array(12));
    // Last 20 bytes should be the account ID
    expect(Buffer.from(bytes.slice(12)).toString("hex")).toBe(
      "86f7dafabaacec5c69bf66611f5449a4251a7525",
    );
  });

  it("same address produces deterministic universal address", () => {
    const addr1 = new XrplAddress(VALID_ADDRESS);
    const addr2 = new XrplAddress(VALID_ADDRESS);
    expect(addr1.toUniversalAddress().equals(addr2.toUniversalAddress())).toBe(true);
  });

  it("equals returns true for same address", () => {
    const addr1 = new XrplAddress(VALID_ADDRESS);
    const addr2 = new XrplAddress(VALID_ADDRESS);
    expect(addr1.equals(addr2)).toBe(true);
  });

  it("equals returns false for different addresses", () => {
    const addr1 = new XrplAddress(VALID_ADDRESS);
    const addr2 = new XrplAddress(XrplZeroAddress);
    expect(addr1.equals(addr2)).toBe(false);
  });

  it("rejects invalid address", () => {
    expect(XrplAddress.isValidAddress("not-an-address")).toBe(false);
  });

  it("constructor throws for invalid address", () => {
    expect(() => new XrplAddress("invalid")).toThrow("Invalid XRPL address");
  });
});

describe("XRPL IOU Token Identifier Tests", () => {
  const IOU_STANDARD = "FOO.rBa2jdUu8S2ZzaCJv8y1Lx9Pdrns51hJj";
  const IOU_HEX = "015841551A748AD2C1F76FF6ECB0CCCD00000000.rBa2jdUu8S2ZzaCJv8y1Lx9Pdrns51hJj";

  it("accepts standard IOU format and round-trips via toString", () => {
    const address = new XrplAddress(IOU_STANDARD);
    expect(address.toString()).toBe(IOU_STANDARD);
    expect(address.format).toBe("iou");
  });

  it("accepts hex-code IOU format and round-trips via toString", () => {
    const address = new XrplAddress(IOU_HEX);
    expect(address.toString()).toBe(IOU_HEX);
    expect(address.format).toBe("iou");
  });

  it("copy constructor preserves IOU address and format", () => {
    const original = new XrplAddress(IOU_STANDARD);
    const copy = new XrplAddress(original);
    expect(copy.toString()).toBe(IOU_STANDARD);
    expect(copy.format).toBe("iou");
  });

  it("toUint8Array encodes standard IOU as 20-byte canonical code + 20-byte issuer", () => {
    const address = new XrplAddress(IOU_STANDARD);
    const bytes = address.toUint8Array();
    expect(bytes.length).toBe(40);
    // "FOO" in XRPL canonical format: bytes 0-11 = 0, bytes 12-14 = ASCII "FOO", bytes 15-19 = 0
    const codeBytes = bytes.slice(0, 20);
    expect(codeBytes[12]).toBe(0x46); // 'F'
    expect(codeBytes[13]).toBe(0x4f); // 'O'
    expect(codeBytes[14]).toBe(0x4f); // 'O'
    expect(codeBytes.slice(0, 12)).toEqual(new Uint8Array(12));
    expect(codeBytes.slice(15)).toEqual(new Uint8Array(5));
  });

  it("toUint8Array encodes hex IOU as 20-byte decoded code + 20-byte issuer", () => {
    const address = new XrplAddress(IOU_HEX);
    const bytes = address.toUint8Array();
    expect(bytes.length).toBe(40);
    // First 20 bytes should be the hex-decoded code
    expect(Buffer.from(bytes.slice(0, 20)).toString("hex")).toBe(
      "015841551a748ad2c1f76ff6ecb0cccd00000000",
    );
    // Last 20 bytes: issuer account ID
    // Verified via: xrpl.decodeAccountID("rBa2jdUu8S2ZzaCJv8y1Lx9Pdrns51hJj")
    expect(Buffer.from(bytes.slice(20)).toString("hex")).toBe(
      "01e8d1a59a95e325433441e1b2117e57c752950c",
    );
  });

  it("toUniversalAddress produces the correct 32-byte sha256 hash", () => {
    const address = new XrplAddress(IOU_STANDARD);
    const ua = address.toUniversalAddress();
    const bytes = ua.toUint8Array();
    expect(bytes.length).toBe(32);
    // Verified via: crypto.createHash("sha256").update("iou:000000000000000000000000464F4F0000000000.rBa2jdUu8S2ZzaCJv8y1Lx9Pdrns51hJj").digest("hex")
    expect(Buffer.from(bytes).toString("hex")).toBe(
      "bd62b8d75492c4278e9637926249944208a208041ae6a1c107efca4e01bb0ec7",
    );
  });

  it("equals returns true for same IOU", () => {
    const a = new XrplAddress(IOU_STANDARD);
    const b = new XrplAddress(IOU_STANDARD);
    expect(a.equals(b)).toBe(true);
  });

  it("equals returns false for different IOUs", () => {
    const a = new XrplAddress(IOU_STANDARD);
    const b = new XrplAddress(IOU_HEX);
    expect(a.equals(b)).toBe(false);
  });

  it("rejects IOU with invalid issuer", () => {
    expect(XrplAddress.isValidAddress("FOO.notAnAddress")).toBe(false);
  });

  it("rejects IOU with empty code (dot at start)", () => {
    expect(XrplAddress.isValidAddress(".rBa2jdUu8S2ZzaCJv8y1Lx9Pdrns51hJj")).toBe(false);
  });

  it("rejects IOU with 2-char code (too short for ISO)", () => {
    expect(XrplAddress.isValidAddress("AB.rBa2jdUu8S2ZzaCJv8y1Lx9Pdrns51hJj")).toBe(false);
  });

  it("rejects IOU with 4-char code (not ISO and not 40-char hex)", () => {
    expect(XrplAddress.isValidAddress("ABCD.rBa2jdUu8S2ZzaCJv8y1Lx9Pdrns51hJj")).toBe(false);
  });

  it("rejects IOU with non-hex 40-char code", () => {
    expect(
      XrplAddress.isValidAddress(
        "ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ.rBa2jdUu8S2ZzaCJv8y1Lx9Pdrns51hJj",
      ),
    ).toBe(false);
  });
});

describe("XRPL MPT Token Identifier Tests", () => {
  const MPT_ID = "00EF0C086C1B25B6A159B32B05B9AE9BE1D6C960951A644F";

  it("accepts MPT issuance ID and round-trips via toString", () => {
    const address = new XrplAddress(MPT_ID);
    expect(address.toString()).toBe(MPT_ID);
    expect(address.format).toBe("mpt");
  });

  it("copy constructor preserves MPT address and format", () => {
    const original = new XrplAddress(MPT_ID);
    const copy = new XrplAddress(original);
    expect(copy.toString()).toBe(MPT_ID);
    expect(copy.format).toBe("mpt");
  });

  it("toUint8Array decodes hex to 24 bytes", () => {
    const address = new XrplAddress(MPT_ID);
    const bytes = address.toUint8Array();
    expect(bytes.length).toBe(24);
    expect(Buffer.from(bytes).toString("hex")).toBe(MPT_ID.toLowerCase());
  });

  it("toUniversalAddress produces the correct 32-byte sha256 hash", () => {
    const address = new XrplAddress(MPT_ID);
    const universal = address.toUniversalAddress();
    const bytes = universal.toUint8Array();
    expect(bytes.length).toBe(32);
    // Verified via: crypto.createHash("sha256").update("mpt:00EF0C086C1B25B6A159B32B05B9AE9BE1D6C960951A644F").digest("hex")
    expect(Buffer.from(bytes).toString("hex")).toBe(
      "3505f691c008fc399f9cecdccb6af3e4df93303d14b0d5c3661ac3ce351b4aa5",
    );
  });

  it("equals returns true for same MPT ID", () => {
    const a = new XrplAddress(MPT_ID);
    const b = new XrplAddress(MPT_ID);
    expect(a.equals(b)).toBe(true);
  });

  it("equals returns false for different formats", () => {
    const mpt = new XrplAddress(MPT_ID);
    const account = new XrplAddress("rBa2jdUu8S2ZzaCJv8y1Lx9Pdrns51hJj");
    expect(mpt.equals(account)).toBe(false);
  });

  it("rejects hex string shorter than 48 chars", () => {
    expect(XrplAddress.isValidAddress("00EF0C086C1B25B6")).toBe(false);
  });

  it("rejects hex string longer than 48 chars", () => {
    expect(XrplAddress.isValidAddress("00EF0C086C1B25B6A159B32B05B9AE9BE1D6C960951A644FAA")).toBe(
      false,
    );
  });

  it("rejects 48-char string with non-hex characters", () => {
    expect(XrplAddress.isValidAddress("ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ")).toBe(
      false,
    );
  });
});
