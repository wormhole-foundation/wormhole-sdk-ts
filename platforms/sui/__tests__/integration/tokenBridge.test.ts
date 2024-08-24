import { describe, expect, test } from "@jest/globals";
import { CONFIG, TokenBridge, toNative } from "@wormhole-foundation/sdk-connect";
import { utils } from "@wormhole-foundation/sdk-definitions/testing";
import { SuiChains, SuiPlatform } from "./../../src/index.js";
import { SUI_COIN } from "../../src/constants.js";

import "@wormhole-foundation/sdk-sui-core";
import "@wormhole-foundation/sdk-sui-tokenbridge";

import nock from "nock";
import path from "path";

const network: "Mainnet" = "Mainnet";
type TNet = typeof network;
const configs = CONFIG[network].chains;

const TOKEN_ADDRESSES = {
  Mainnet: {
    Sui: {
      wsui: SUI_COIN,
      wavax: "0x1e8b532cca6569cab9f9b9ebc73f8c13885012ade714729aa3b450e0339ac766::coin::COIN",
    },
  },
};

//const senderAddress = utils.makeNativeAddress("Sui");
const bogusAddress = utils.makeNativeAddress("Sui");

const realNativeAddress = toNative("Sui", TOKEN_ADDRESSES["Mainnet"]["Sui"]["wsui"]);
const realWrappedAddress = toNative("Sui", TOKEN_ADDRESSES["Mainnet"]["Sui"]["wavax"]);

// Setup nock to record fixtures
const nockBack = nock.back;
nockBack.fixtures = __dirname ?? path.resolve() + "/__tests__/integration/fixtures";

let nockDone: () => void;
beforeEach(async () => {
  nockBack.setMode("update");
  const fullTestName = expect.getState().currentTestName?.replace(/\s/g, "_");
  const { nockDone: nd } = await nockBack(`${fullTestName}.json`);
  // update global var
  nockDone = nd;
});

afterEach(async () => {
  nockDone();
  nockBack.setMode("wild");
});

describe("TokenBridge Tests", () => {
  const p = new SuiPlatform(network, configs);

  let tb: TokenBridge<TNet, SuiChains>;

  test("Create TokenBridge", async () => {
    const rpc = p.getRpc("Sui");
    tb = await p.getProtocol("TokenBridge", rpc);
    expect(tb).toBeTruthy();
  });

  describe("Get Wrapped Asset Details", () => {
    describe("isWrappedAsset", () => {
      test("Bogus", async () => {
        const isWrapped = await tb.isWrappedAsset(bogusAddress);
        expect(isWrapped).toBe(false);
      });

      test("Real Not Wrapped", async () => {
        const isWrapped = await tb.isWrappedAsset(realNativeAddress);
        expect(isWrapped).toBe(false);
      });

      test("Real Wrapped", async () => {
        const isWrapped = await tb.isWrappedAsset(realWrappedAddress);
        expect(isWrapped).toBe(true);
      });
    });

    describe("getOriginalAsset", () => {
      test("Bogus", async () => {
        expect(() => tb.getOriginalAsset(bogusAddress)).rejects.toThrow();
      });

      test("Real Not Wrapped", async () => {
        expect(() => tb.getOriginalAsset(realNativeAddress)).rejects.toThrow();
      });

      test("Real Wrapped", async () => {
        const orig = await tb.getOriginalAsset(realWrappedAddress);
        expect(orig.chain).toEqual("Avalanche");
        expect(orig).toBeTruthy();
      });
    });

    describe("hasWrappedAsset", () => {
      test("Bogus", async () => {
        const hasWrapped = await tb.hasWrappedAsset({
          chain: "Avalanche",
          address: bogusAddress,
        });
        expect(hasWrapped).toBe(false);
      });

      test("Real Not Wrapped", async () => {
        const hasWrapped = await tb.hasWrappedAsset({
          chain: "Avalanche",
          address: realNativeAddress,
        });
        expect(hasWrapped).toBe(false);
      });

      test("Real Wrapped", async () => {
        const orig = await tb.getOriginalAsset(realWrappedAddress);
        console.log(orig);
        const hasWrapped = await tb.hasWrappedAsset(orig);
        expect(hasWrapped).toBe(true);
      });
    });

    describe("getWrappedAsset", () => {
      test("Bogus", async () => {
        const hasWrapped = tb.getWrappedAsset({
          chain: "Avalanche",
          address: bogusAddress,
        });
        expect(hasWrapped).rejects.toThrow();
      });

      test("Real Not Wrapped", async () => {
        const hasWrapped = tb.getWrappedAsset({
          chain: "Avalanche",
          address: realNativeAddress,
        });
        expect(hasWrapped).rejects.toThrow();
      });

      test("Real Wrapped", async () => {
        const orig = await tb.getOriginalAsset(realWrappedAddress);
        const wrappedAsset = await tb.getWrappedAsset(orig);
        expect(wrappedAsset.toString()).toBe(realWrappedAddress.toString());
      });
    });
  });

  // describe("Create Token Attestation Transactions", () => {
  //   const chain = "Sui";
  //   test("Create Attestation", async () => {
  //     const attestation = tb.createAttestation(realNativeAddress, senderAddress);
  //     const allTxns = [];
  //     for await (const atx of attestation) {
  //       allTxns.push(atx);
  //     }
  //     expect(allTxns).toHaveLength(1);

  //     const [attestTx] = allTxns;
  //     expect(attestTx).toBeTruthy();
  //     expect(attestTx!.chain).toEqual(chain);

  //     const { transaction } = attestTx!;
  //     expect(transaction.arguments).toHaveLength(0);
  //   });

  //   test("Submit Attestation", async () => {
  //     const vaa = createVAA("TokenBridge:AttestMeta", {
  //       payload: {
  //         token: {
  //           address: realNativeAddress.toUniversalAddress(),
  //           chain: "Avalanche",
  //         },
  //         decimals: 8,
  //         symbol: Buffer.from(new Uint8Array(16)).toString("hex"),
  //         name: Buffer.from(new Uint8Array(16)).toString("hex"),
  //       },
  //       guardianSet: 3,
  //       signatures: [{ guardianIndex: 0, signature: new Signature(1n, 2n, 1) }],
  //       emitterChain: "Avalanche",
  //       emitterAddress: new UniversalAddress(new Uint8Array(32)),
  //       sequence: 0n,
  //       consistencyLevel: 0,
  //       timestamp: 0,
  //       nonce: 0,
  //     });
  //     const submitAttestation = tb.submitAttestation(vaa, senderAddress);

  //     const allTxns = [];
  //     for await (const atx of submitAttestation) {
  //       allTxns.push(atx);
  //     }
  //     expect(allTxns).toHaveLength(2);
  //   });
  // });

  //describe("Create TokenBridge Transactions", () => {
  //  const chain = "Sui";
  //  const destChain = "Ethereum";

  //  const recipient = testing.utils.makeUniversalChainAddress(destChain);

  //  const amount = 1000n;
  //  const payload: Uint8Array | undefined = undefined;

  //  describe("Token Transfer Transactions", () => {
  //    describe("Transfer", () => {
  //      test("Native", async () => {
  //        const token = "native";
  //        const xfer = tb.transfer(senderAddress, recipient, token, amount, payload);
  //        expect(xfer).toBeTruthy();

  //        const allTxns = [];
  //        for await (const tx of xfer) {
  //          allTxns.push(tx);
  //        }
  //        expect(allTxns).toHaveLength(1);

  //        const [xferTx] = allTxns;
  //        expect(xferTx).toBeTruthy();
  //        expect(xferTx!.chain).toEqual(chain);

  //        const { transaction } = xferTx!;
  //        expect(transaction.arguments).toHaveLength(5);
  //        // ...
  //      });

  //      test("Token", async () => {
  //        const xfer = tb.transfer(senderAddress, recipient, realWrappedAddress, amount, payload);
  //        expect(xfer).toBeTruthy();

  //        const allTxns = [];
  //        for await (const tx of xfer) {
  //          allTxns.push(tx);
  //        }
  //        expect(allTxns).toHaveLength(1);

  //        const [xferTx] = allTxns;
  //        expect(xferTx).toBeTruthy();
  //        expect(xferTx!.chain).toEqual(chain);

  //        const { transaction } = xferTx!;
  //        expect(transaction.type_arguments).toHaveLength(1);
  //        expect(transaction.arguments).toHaveLength(5);
  //      });
  //    });
  //  });
  //});
});
