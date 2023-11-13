import {
  CONFIG,
  Chain,
  Signature,
  TokenBridge,
  createVAA,
  encoding,
  toNative,
} from "@wormhole-foundation/connect-sdk";
import {
  CosmwasmChains,
  CosmwasmPlatform,
  chainToNativeDenoms
} from "../../src";

import "@wormhole-foundation/connect-sdk-cosmwasm-core";
import "@wormhole-foundation/connect-sdk-cosmwasm-tokenbridge";

const network: "Testnet" = "Testnet"; //DEFAULT_NETWORK;
type TNet = typeof network;
const configs = CONFIG[network].chains;

const chain: CosmwasmChains = "Sei";
const realNativeAddress = toNative(chain, chainToNativeDenoms(network, chain));

const sender = "sei1x76thkmwy03attv3j28ekkfmkhnyah3qnzwvn4";
const senderAddress = toNative(chain, sender);

// address for "turtle" a cw20 on sei
const nativeTokenAddress = toNative(
  chain,
  "sei16aa3whueaddmms3qw0apz7ylddg0vwtw2zugafmccdtrxrwyx0kqwxntat"
);

// Wrapped avax on sei
const wrappedTokenChain: Chain = "Avalanche";
const realWrappedAddress = toNative(
  chain,
  "sei1mgpq67pj7p2acy5x7r5lz7fulxmuxr3uh5f0szyvqgvru3glufzsxk8tnx"
);

// rando address, i think this is the token bridge
const bogusAddress = toNative(
  chain,
  "sei1dkdwdvknx0qav5cp5kw68mkn3r99m3svkyjfvkztwh97dv2lm0ksj6xrak"
);

describe("TokenBridge Tests", () => {
  const p = new CosmwasmPlatform(network, configs);

  let tb: TokenBridge<TNet, 'Cosmwasm', typeof chain>;
  test("Create TokenBridge", async () => {
    const rpc = await p.getRpc(chain);
    tb = await p.getProtocol("TokenBridge", rpc)
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
      const attestation = tb.createAttestation(
        nativeTokenAddress,
        senderAddress
      );
      const allTxns = [];
      for await (const atx of attestation) {
        allTxns.push(atx);
      }
      expect(allTxns).toHaveLength(1);
      const [attestTx] = allTxns;
      expect(attestTx).toBeTruthy();
      expect(attestTx.chain).toEqual(chain);
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
      expect(attestTx.chain).toEqual(chain);
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
          expect(xferTx.chain).toEqual(chain);
        });

        test("Token", async () => {
          const xfer = tb.transfer(
            senderAddress,
            recipient,
            realWrappedAddress,
            amount,
            payload
          );
          expect(xfer).toBeTruthy();

          const allTxns = [];
          for await (const tx of xfer) {
            allTxns.push(tx);
          }
          expect(allTxns).toHaveLength(1);

          const msgs = allTxns[0].transaction.msgs;
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
