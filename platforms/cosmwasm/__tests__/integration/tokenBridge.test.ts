import {
  CONFIG,
  Chain,
  DEFAULT_NETWORK,
  Network,
  Signature,
  TokenBridge,
  contracts,
  createVAA,
  encoding,
  toNative,
} from "@wormhole-foundation/sdk-connect";
import { CosmwasmChains, CosmwasmPlatform, chainToNativeDenoms } from "./../../src/index.js";

import "@wormhole-foundation/sdk-cosmwasm-core";
import "@wormhole-foundation/sdk-cosmwasm-tokenbridge";
import nock from "nock";
import path from "path";

const network = DEFAULT_NETWORK;
const configs = CONFIG[network].chains;

const chain: CosmwasmChains = "Injective";
const realNativeAddress = toNative(chain, chainToNativeDenoms(network, chain));

const sender = "inj1vhjzaf3uuzfxmaypkuqrf9rmc9xx7677xxegay";
const senderAddress = toNative(chain, sender);

const nativeTokenAddress = toNative(chain, "inj1sthrn5ep8ls5vzz8f9gp89khhmedahhdkqa8z3");

// Wrapped avax on sei
const wrappedTokenChain: Chain = "Avalanche";
const realWrappedAddress = toNative(chain, "inj18a2u6az6dzw528rptepfg6n49ak6hdzkny4um6");

// rando address, just use the token bridge contract address
const bogusAddress = toNative(chain, contracts.tokenBridge("Mainnet", "Injective"));

// Setup nock to record fixtures
const nockBack = nock.back;
nockBack.fixtures = (__dirname ?? path.resolve() + "/__tests__/integration") + "/fixtures";

let nockDone: () => void;
beforeEach(async () => {
  nockBack.setMode("lockdown");
  const fullTestName = expect.getState().currentTestName?.replace(/\s/g, "_");
  const { nockDone: nd } = await nockBack(`${fullTestName}.json`, {
    // Remove the `id` from the request body after preparing it but before
    // trying to match a fixture.
    after: (scope) => {
      scope.filteringRequestBody((body: string) => {
        const o = JSON.parse(body) as { id?: string };
        delete o.id;
        return JSON.stringify(o);
      });
    },
    // Remove the `id` from the request body before saving it as a fixture.
    afterRecord: (defs) => {
      return defs.map((d: nock.Definition) => {
        const body = d.body as { id?: string };
        delete body.id;
        d.body = body;
        return d;
      });
    },
  });

  // update global var
  nockDone = nd;
});

afterEach(async () => {
  nockDone();
  nockBack.setMode("wild");
});

describe("TokenBridge Tests", () => {
  const p = new CosmwasmPlatform(network, configs);

  let tb: TokenBridge<Network, CosmwasmChains>;
  test("Create TokenBridge", async () => {
    const rpc = await p.getRpc(chain);
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
        expect(orig.chain).toEqual(wrappedTokenChain);
        expect(orig).toBeTruthy();
      });
    });

    describe("hasWrappedAsset", () => {
      test("Bogus", async () => {
        const hasWrapped = await tb.hasWrappedAsset({
          chain: wrappedTokenChain,
          address: bogusAddress,
        });
        expect(hasWrapped).toBe(false);
      });

      test("Real Not Wrapped", async () => {
        const hasWrapped = await tb.hasWrappedAsset({
          chain: chain,
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
          chain: wrappedTokenChain,
          address: bogusAddress,
        });
        expect(hasWrapped).rejects.toThrow();
      });

      test("Real Not Wrapped", async () => {
        const hasWrapped = tb.getWrappedAsset({
          chain: chain,
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
    const tbAddress = p.config[chain]!.contracts.tokenBridge!;
    test("Create Attestation", async () => {
      const attestation = tb.createAttestation(nativeTokenAddress, senderAddress);
      const allTxns = [];
      for await (const atx of attestation) {
        allTxns.push(atx);
      }
      expect(allTxns).toHaveLength(1);
      const [attestTx] = allTxns;
      expect(attestTx).toBeTruthy();
      expect(attestTx!.chain).toEqual(chain);
    });

    test("Submit Attestation", async () => {
      const vaa = createVAA("TokenBridge:AttestMeta", {
        payload: {
          token: {
            address: nativeTokenAddress.toUniversalAddress(),
            chain: chain,
          },
          decimals: 8,
          symbol: encoding.hex.encode(new Uint8Array(16)),
          name: encoding.hex.encode(new Uint8Array(16)),
        },
        guardianSet: 0,
        signatures: [{ guardianIndex: 0, signature: new Signature(1n, 2n, 1) }],
        emitterChain: chain,
        emitterAddress: toNative(chain, tbAddress).toUniversalAddress(),
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
      expect(allTxns).toHaveLength(1);
      const [attestTx] = allTxns;
      expect(attestTx).toBeTruthy();
      expect(attestTx!.chain).toEqual(chain);
    });
  });

  describe("Create TokenBridge Transactions", () => {
    const recipient = {
      chain: "Cosmoshub" as Chain,
      address: toNative("Cosmoshub", sender).toUniversalAddress(),
    };
    describe("Token Transfer Transactions", () => {
      describe("Transfer", () => {
        const amount = 1000n;
        const payload: Uint8Array | undefined = undefined;

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
        });

        test("Token", async () => {
          const xfer = tb.transfer(senderAddress, recipient, realWrappedAddress, amount, payload);
          expect(xfer).toBeTruthy();

          const allTxns = [];
          for await (const tx of xfer) {
            allTxns.push(tx);
          }
          expect(allTxns).toHaveLength(1);

          const msgs = allTxns[0]!.transaction.msgs;
          expect(msgs).toHaveLength(2);

          const [approveTx, xferTx] = msgs;
          expect(approveTx).toBeTruthy();
          expect(approveTx.value.sender).toEqual(senderAddress.toString());
          expect(xferTx).toBeTruthy();
          expect(xferTx.value.sender).toEqual(senderAddress.toString());

          //expect(approveTx).toEqual(chain);

          // const { transaction: approveTransaction } = approveTx;
          // expect(approveTransaction.msgs[0].).toEqual(realWrappedAddress.toString());
          // const { transaction: xferTransaction } = xferTx;
          // expect(xferTransaction.to).toEqual(tbAddress.toString());
          // expect(xferTransaction.chainId).toEqual(
          //   evmNetworkChainToEvmChainId(network, chain)
          // );
        });
      });
    });
  });
});
