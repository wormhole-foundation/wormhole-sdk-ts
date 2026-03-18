import { Client } from "xrpl";
import { XrplPlatform } from "../../src/platform.js";
import { XrplZeroAddress } from "../../src/address.js";

jest.setTimeout(30_000);

const TESTNET_RPC = "wss://s.altnet.rippletest.net:51233";

// Well-known genesis / faucet-funded testnet account
// (always exists, always has a balance)
const TESTNET_ACCOUNT = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe";

let client: Client;

beforeAll(async () => {
  client = new Client(TESTNET_RPC);
  await client.connect();
});

afterAll(async () => {
  if (client.isConnected()) {
    await client.disconnect();
  }
});

describe("XrplPlatform — static helpers (no RPC)", () => {
  it("isSupportedChain returns true for Xrpl", () => {
    expect(XrplPlatform.isSupportedChain("Xrpl")).toBe(true);
  });

  it("isSupportedChain returns false for Ethereum", () => {
    expect(XrplPlatform.isSupportedChain("Ethereum")).toBe(false);
  });

  it("nativeTokenId uses the zero address", () => {
    const token = XrplPlatform.nativeTokenId("Testnet", "Xrpl");
    expect(token.chain).toBe("Xrpl");
    expect(token.address.toString()).toBe(XrplZeroAddress);
  });

  it("isNativeTokenId matches the native token", () => {
    const token = XrplPlatform.nativeTokenId("Testnet", "Xrpl");
    expect(XrplPlatform.isNativeTokenId("Testnet", "Xrpl", token)).toBe(true);
  });

  it("isNativeTokenId rejects wrong chain", () => {
    const token = XrplPlatform.nativeTokenId("Testnet", "Xrpl");
    expect(
      XrplPlatform.isNativeTokenId("Testnet", "Xrpl", {
        ...token,
        chain: "Ethereum" as any,
      }),
    ).toBe(false);
  });

  it("getDecimals returns 6 for native token", async () => {
    const d = await XrplPlatform.getDecimals("Testnet", "Xrpl", client as any, "native");
    expect(d).toBe(6);
  });
});

describe("XrplPlatform — testnet RPC integration", () => {
  it("chainFromRpc detects Testnet", async () => {
    const [network, chain] = await XrplPlatform.chainFromRpc(client);
    expect(network).toBe("Testnet");
    expect(chain).toBe("Xrpl");
  });

  it("getBalance returns a positive bigint for a funded account", async () => {
    const balance = await XrplPlatform.getBalance(
      "Testnet",
      "Xrpl",
      client,
      TESTNET_ACCOUNT,
      "native",
    );
    expect(balance).not.toBeNull();
    expect(typeof balance).toBe("bigint");
    expect(balance!).toBeGreaterThan(0n);
  });

  it("getBalance returns drops (6 decimals)", async () => {
    const balance = await XrplPlatform.getBalance(
      "Testnet",
      "Xrpl",
      client,
      TESTNET_ACCOUNT,
      "native",
    );
    // Balance is in drops; even 1 XRP = 1_000_000 drops
    // Testnet accounts usually have at least the 10 XRP reserve
    expect(balance!).toBeGreaterThanOrEqual(10_000_000n);
  });

  it("getRpc returns a Client instance", () => {
    const platform = new XrplPlatform("Testnet");
    const rpc = platform.getRpc("Xrpl");
    expect(rpc).toBeInstanceOf(Client);
  });

  it("getChain returns an XrplChain context", () => {
    const platform = new XrplPlatform("Testnet");
    const chain = platform.getChain("Xrpl");
    expect(chain.chain).toBe("Xrpl");
  });

  it("getChain throws for unsupported chain", () => {
    const platform = new XrplPlatform("Testnet");
    expect(() => platform.getChain("Ethereum" as any)).toThrow(
      "No configuration available for chain",
    );
  });

  it("getBalance returns null for non-existent IOU trust line", async () => {
    const balance = await XrplPlatform.getBalance(
      "Testnet",
      "Xrpl",
      client,
      TESTNET_ACCOUNT,
      "FOO.rBa2jdUu8S2ZzaCJv8y1Lx9Pdrns51hJj" as any,
    );
    expect(balance).toBeNull();
  });

  it("getDecimals returns 9 for IOU tokens", () => {
    return expect(
      XrplPlatform.getDecimals("Testnet", "Xrpl", client as any, "USD.rBa2jdUu8S2ZzaCJv8y1Lx9Pdrns51hJj" as any),
    ).resolves.toBe(9);
  });
});
