import { UniversalAddress } from "../src/universalAddress";

describe("UniversalAddress tests", function () {
  it("should correctly construct from a 20 byte hex string without 0x prefix", function () {
    const address = "98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B";
    const ua = new UniversalAddress(address);
    expect(ua.toString()).toEqual("0x" + "00".repeat(12) + address.toLowerCase());
  });

  it("should correctly construct from a 32 byte hex string with 0x prefix", function () {
    const address = "0x5bc11445584a763c1fa7ed39081f1b920954da14e04b32440cba863d03e19625";
    const ua = new UniversalAddress(address);
    expect(ua.toString()).toEqual(address);
  });

  it("should correctly construct from a base58 string", function () {
    //solana token bridge address
    const address = "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb";
    //this is not the emitter address because the emitter is a pda with seed "emitter"
    const hexAddr = "0x0e0a589e6488147a94dcfa592b90fdd41152bb2ca77bf6016758a6f4df9d21b4";
    const ua = new UniversalAddress(address, "base58");
    expect(ua.toString()).toEqual(hexAddr);
  });

  it("should correctly construct from a bech32 string", function () {
    const address = "wormhole1466nf3zuxpya8q9emxukd7vftaf6h4psr0a07srl5zw74zh84yjq4lyjmh";
    const hexAddr = "0xaeb534c45c3049d380b9d9b966f9895f53abd4301bfaff407fa09dea8ae7a924";
    const ua = new UniversalAddress(address, "bech32");
    expect(ua.toString()).toEqual(hexAddr);
  });

  it("should correctly construct from an Algorand app id", function () {
    const appId = "86525641";
    const appAddress = "0x6241ffdc032b693bfb8544858f0403dec86f2e1720af9f34f8d65fe574b6238c";
    const ua = new UniversalAddress(appId, "algorandAppId");
    expect(ua.toString()).toEqual(appAddress)
  });
});