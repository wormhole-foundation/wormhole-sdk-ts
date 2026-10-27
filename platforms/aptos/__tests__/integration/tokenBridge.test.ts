import {
  CONFIG,
  Signature,
  TokenBridge,
  UniversalAddress,
  createVAA,
  toNative,
} from "@wormhole-foundation/sdk-connect";
import { utils } from "@wormhole-foundation/sdk-definitions/testing";

import "@wormhole-foundation/sdk-aptos-core";
import "@wormhole-foundation/sdk-aptos-tokenbridge";

import { APTOS_COIN, AptosChains, AptosPlatform } from "./../../src/index.js";

import { Aptos, AptosConfig, Network as AptosNetwork } from "@aptos-labs/ts-sdk";
import type { Client, ClientRequest, ClientResponse } from "@aptos-labs/ts-sdk";

import { describe, expect, test } from "@jest/globals";

import https from "https";
import nock from "nock";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const network: "Mainnet" = "Mainnet";
type TNet = typeof network;
const configs = CONFIG[network].chains;

const TOKEN_ADDRESSES = {
  Mainnet: {
    Aptos: {
      waptos: APTOS_COIN,
      wsol: "0xdd89c0e695df0692205912fb69fc290418bed0dbe6e4573d744a6d5e6bab6c13::coin::T",
    },
  },
};

const senderAddress = utils.makeNativeAddress("Aptos");
const bogusAddress = utils.makeNativeAddress("Aptos");
const realNativeAddress = toNative("Aptos", TOKEN_ADDRESSES["Mainnet"]["Aptos"]["waptos"]);
const realWrappedAddress = toNative("Aptos", TOKEN_ADDRESSES["Mainnet"]["Aptos"]["wsol"]);

// The default Aptos client (@aptos-labs/aptos-client) always uses HTTP/2, which nock
// cannot intercept, so requests would bypass the fixtures and hit the live node.
// This client issues the same requests over HTTP/1 so nock can record and replay them.
const http1Client: Client = {
  provider<Req, Res>({ url, method, params, headers, body }: ClientRequest<Req>) {
    const target = new URL(url);
    for (const [key, value] of Object.entries(params ?? {}))
      if (value !== undefined) target.searchParams.set(key, String(value));

    const payload =
      body === undefined
        ? undefined
        : body instanceof Uint8Array
          ? Buffer.from(body)
          : Buffer.from(JSON.stringify(body));

    const reqHeaders = Object.fromEntries(
      Object.entries(headers ?? {}).filter(([, value]) => value !== undefined),
    ) as Record<string, string>;

    return new Promise<ClientResponse<Res>>((resolve, reject) => {
      const req = https.request(target, { method, headers: reqHeaders }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("error", reject);
        res.on("end", () => {
          const raw = Buffer.concat(chunks);
          const isJson = (res.headers["content-type"] ?? "").includes("json");
          resolve({
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? "",
            data: (isJson && raw.length > 0 ? JSON.parse(raw.toString()) : raw) as Res,
            headers: res.headers,
            response: res,
          });
        });
      });
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  },
};

// Setup nock to record fixtures
const nockBack = nock.back;
nockBack.fixtures = path.join(__dirname, "fixtures");

let nockDone: () => void;
beforeEach(async () => {
  // Re-record fixtures against the live node with NOCK_BACK_MODE=record
  nockBack.setMode((process.env["NOCK_BACK_MODE"] as nock.BackMode | undefined) ?? "lockdown");
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
  const p = new AptosPlatform(network, configs);

  let tb: TokenBridge<TNet, AptosChains>;

  test("Create TokenBridge", async () => {
    const rpc = new Aptos(
      new AptosConfig({
        fullnode: configs.Aptos!.rpc,
        network: AptosNetwork.MAINNET,
        client: http1Client,
      }),
    );
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
        expect(orig.chain).toEqual("Solana");
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

  describe("Create Token Attestation Transactions", () => {
    const chain = "Aptos";
    test("Create Attestation", async () => {
      const attestation = tb.createAttestation(realNativeAddress, senderAddress);
      const allTxns = [];
      for await (const atx of attestation) {
        allTxns.push(atx);
      }
      expect(allTxns).toHaveLength(1);

      const [attestTx] = allTxns;
      expect(attestTx).toBeTruthy();
      expect(attestTx!.chain).toEqual(chain);

      const { transaction } = attestTx!;
      expect(transaction.functionArguments).toHaveLength(0);
    });

    test("Submit Attestation", async () => {
      const vaa = createVAA("TokenBridge:AttestMeta", {
        payload: {
          token: {
            address: realNativeAddress.toUniversalAddress(),
            chain: "Avalanche",
          },
          decimals: 8,
          symbol: Buffer.from(new Uint8Array(16)).toString("hex"),
          name: Buffer.from(new Uint8Array(16)).toString("hex"),
        },
        guardianSet: 3,
        signatures: [{ guardianIndex: 0, signature: new Signature(1n, 2n, 1) }],
        emitterChain: "Avalanche",
        emitterAddress: new UniversalAddress(new Uint8Array(32)),
        sequence: 0n,
        consistencyLevel: 0,
        timestamp: 0,
        nonce: 0,
      });
      const submitAttestation = tb.submitAttestation(vaa, senderAddress);

      const allTxns = [];
      for await (const atx of submitAttestation) {
        allTxns.push(atx);
      }
      expect(allTxns).toHaveLength(2);
    });
  });

  describe("Create TokenBridge Transactions", () => {
    const chain = "Aptos";
    const destChain = "Ethereum";

    const recipient = utils.makeUniversalChainAddress(destChain);

    const amount = 1000n;
    const payload: Uint8Array | undefined = undefined;

    describe("Token Transfer Transactions", () => {
      describe("Transfer", () => {
        test("Native", async () => {
          const token = "native";
          const xfer = tb.transfer(senderAddress, recipient, token, amount, payload);
          expect(xfer).toBeTruthy();

          const allTxns = [];
          for await (const tx of xfer) {
            allTxns.push(tx);
          }
          expect(allTxns).toHaveLength(1);

          const [xferTx] = allTxns;
          expect(xferTx).toBeTruthy();
          expect(xferTx!.chain).toEqual(chain);

          const { transaction } = xferTx!;
          expect(transaction.functionArguments).toHaveLength(5);
          // ...
        });

        test("Token", async () => {
          const xfer = tb.transfer(senderAddress, recipient, realWrappedAddress, amount, payload);
          expect(xfer).toBeTruthy();

          const allTxns = [];
          for await (const tx of xfer) {
            allTxns.push(tx);
          }
          expect(allTxns).toHaveLength(1);

          const [xferTx] = allTxns;
          expect(xferTx).toBeTruthy();
          expect(xferTx!.chain).toEqual(chain);

          const { transaction } = xferTx!;
          expect(transaction.typeArguments).toHaveLength(1);
          expect(transaction.functionArguments).toHaveLength(5);
        });
      });
    });
  });
});
