import { Client, Wallet } from "xrpl";
import { XrplSigner, getXrplSigner } from "../../src/signer.js";
import { XrplUnsignedTransaction } from "../../src/unsignedTransaction.js";

jest.setTimeout(60_000);

const TESTNET_RPC = "wss://s.altnet.rippletest.net:51233";

let client: Client;
let fundedWallet: Wallet;

beforeAll(async () => {
  client = new Client(TESTNET_RPC);
  await client.connect();

  // Fund a fresh wallet via the testnet faucet
  const fundResult = await client.fundWallet();
  fundedWallet = fundResult.wallet;
});

afterAll(async () => {
  if (client.isConnected()) {
    await client.disconnect();
  }
});

describe("XrplSigner — testnet integration", () => {
  it("getXrplSigner creates a signer from seed", async () => {
    const signer = await getXrplSigner(client, fundedWallet.seed!);
    expect(signer.chain()).toBe("Xrpl");
    expect(signer.address()).toBe(fundedWallet.classicAddress);
  });

  it("sign() produces a signed tx blob without submitting", async () => {
    const signer = new XrplSigner("Xrpl", "Testnet", client, fundedWallet.seed!);

    const unsignedTx = new XrplUnsignedTransaction(
      {
        TransactionType: "Payment",
        Account: fundedWallet.classicAddress,
        Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
        Amount: "1000000", // 1 XRP in drops
      },
      "Testnet",
      "Xrpl",
      "Test payment sign-only",
    );

    const signed = await signer.sign([unsignedTx]);
    expect(signed).toHaveLength(1);
    expect(typeof signed[0]).toBe("string");
    expect(signed[0]!.length).toBeGreaterThan(0);
  });

  it("signAndSend() submits a payment and returns a tx hash", async () => {
    const signer = new XrplSigner("Xrpl", "Testnet", client, fundedWallet.seed!);

    const unsignedTx = new XrplUnsignedTransaction(
      {
        TransactionType: "Payment",
        Account: fundedWallet.classicAddress,
        Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
        Amount: "1000000", // 1 XRP in drops
      },
      "Testnet",
      "Xrpl",
      "Test payment sign-and-send",
    );

    const hashes = await signer.signAndSend([unsignedTx]);
    expect(hashes).toHaveLength(1);
    expect(typeof hashes[0]).toBe("string");
    // XRPL tx hashes are 64 hex chars
    expect(hashes[0]).toMatch(/^[A-F0-9]{64}$/);
  });

  it("sign() handles multiple transactions", async () => {
    const signer = new XrplSigner("Xrpl", "Testnet", client, fundedWallet.seed!);

    const tx1 = new XrplUnsignedTransaction(
      {
        TransactionType: "Payment",
        Account: fundedWallet.classicAddress,
        Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
        Amount: "100000",
      },
      "Testnet",
      "Xrpl",
      "Batch tx 1",
    );

    const tx2 = new XrplUnsignedTransaction(
      {
        TransactionType: "Payment",
        Account: fundedWallet.classicAddress,
        Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
        Amount: "200000",
      },
      "Testnet",
      "Xrpl",
      "Batch tx 2",
    );

    const signed = await signer.sign([tx1, tx2]);
    expect(signed).toHaveLength(2);
    expect(signed[0]).not.toBe(signed[1]);
  });
});
