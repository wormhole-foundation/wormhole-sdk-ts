import {
  CONFIG,
  ChainAddress,
  DEFAULT_NETWORK,
  Signature,
  TokenBridge,
  UniversalAddress,
  createVAA,
  encoding,
  nativeChainIds,
  testing,
  toNative,
} from '@wormhole-foundation/connect-sdk';

import '@wormhole-foundation/connect-sdk-evm-core';
import '@wormhole-foundation/connect-sdk-evm-tokenbridge';

import { EvmChains, EvmPlatform } from '../../src';

import { describe, expect, test } from '@jest/globals';

import nock from 'nock';

// Setup nock to record fixtures
const nockBack = nock.back;
nockBack.fixtures = __dirname + '/fixtures';

let nockDone: () => void;
beforeEach(async () => {
  nockBack.setMode('lockdown');
  const fullTestName = expect.getState().currentTestName?.replace(/\s/g, '_');
  const { nockDone: nd } = await nockBack(`${fullTestName}.json`, {
    // Remove the `id` from the request body after preparing it but before
    // trying to match a fixture.
    after: (scope) => {
      scope.filteringRequestBody((body: string) => {
        const b = JSON.parse(body);

        let formattedBody = b;
        if (Array.isArray(b)) {
          formattedBody = b.map((o) => {
            delete o.id;
            return o;
          });
        } else {
          delete formattedBody.id;
        }
        return JSON.stringify(formattedBody);
      });
    },
    // Remove the `id` from the request body before saving it as a fixture.
    afterRecord: (defs) => {
      return defs.map((d: nock.Definition) => {
        if (typeof d.body !== 'object') return d;

        if (Array.isArray(d.body)) {
          const body = d.body as { id?: string }[];
          d.body = body.map((o) => {
            delete o.id;
            return o;
          });
        } else {
          const body = d.body as { id?: string };
          delete body.id;
          d.body = body;
        }
        return d;
      });
    },
  });

  // update global var
  nockDone = nd;
});

afterEach(async () => {
  nockDone();
  nockBack.setMode('wild');
});

const network = DEFAULT_NETWORK;
const configs = CONFIG[network].chains;

const TOKEN_ADDRESSES = {
  Mainnet: {
    Ethereum: {
      wsteth: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
      wavax: '0x85f138bfEE4ef8e540890CFb48F620571d67Eda3',
    },
  },
};

const bogusAddress = toNative(
  'Ethereum',
  '0x0000c581f595b53c5cb19bd0b3f8da6c935e2ca0',
);
const realNativeAddress = toNative(
  'Ethereum',
  TOKEN_ADDRESSES['Mainnet']['Ethereum']['wsteth'],
);
const realWrappedAddress = toNative(
  'Ethereum',
  TOKEN_ADDRESSES['Mainnet']['Ethereum']['wavax'],
);

const chain = 'Ethereum';
const destChain = 'Avalanche';

const sender = toNative('Ethereum', new Uint8Array(20));
const recipient: ChainAddress = {
  chain: destChain,
  address: new UniversalAddress(new Uint8Array(32)),
};

describe('TokenBridge Tests', () => {
  const p = new EvmPlatform(network, configs);
  let tb: TokenBridge<typeof network, 'Evm', EvmChains>;

  test('Create TokenBridge', async () => {
    const rpc = p.getRpc('Ethereum');
    tb = await p.getProtocol('TokenBridge', rpc);
    expect(tb).toBeTruthy();
  });

  describe('Get Wrapped Asset Details', () => {
    describe('isWrappedAsset', () => {
      test('Bogus', async () => {
        const isWrapped = await tb.isWrappedAsset(bogusAddress);
        expect(isWrapped).toBe(false);
      });

      test('Real Not Wrapped', async () => {
        const isWrapped = await tb.isWrappedAsset(realNativeAddress);
        expect(isWrapped).toBe(false);
      });

      test('Real Wrapped', async () => {
        const isWrapped = await tb.isWrappedAsset(realWrappedAddress);
        expect(isWrapped).toBe(true);
      });
    });

    describe('getOriginalAsset', () => {
      test('Bogus', async () => {
        expect(() => tb.getOriginalAsset(bogusAddress)).rejects.toThrow();
      });

      test('Real Not Wrapped', async () => {
        expect(() => tb.getOriginalAsset(realNativeAddress)).rejects.toThrow();
      });

      test('Real Wrapped', async () => {
        const orig = await tb.getOriginalAsset(realWrappedAddress);
        expect(orig.chain).toEqual('Avalanche');
        expect(orig).toBeTruthy();
      });
    });

    describe('hasWrappedAsset', () => {
      test('Bogus', async () => {
        const hasWrapped = await tb.hasWrappedAsset({
          chain: 'Avalanche',
          address: bogusAddress,
        });
        expect(hasWrapped).toBe(false);
      });

      test('Real Not Wrapped', async () => {
        const hasWrapped = await tb.hasWrappedAsset({
          chain: 'Avalanche',
          address: realNativeAddress,
        });
        expect(hasWrapped).toBe(false);
      });

      test('Real Wrapped', async () => {
        const orig = await tb.getOriginalAsset(realWrappedAddress);
        const hasWrapped = await tb.hasWrappedAsset(orig);
        expect(hasWrapped).toBe(true);
      });
    });

    describe('getWrappedAsset', () => {
      test('Bogus', async () => {
        const hasWrapped = tb.getWrappedAsset({
          chain: 'Avalanche',
          address: bogusAddress,
        });
        expect(hasWrapped).rejects.toThrow();
      });

      test('Real Not Wrapped', async () => {
        const hasWrapped = tb.getWrappedAsset({
          chain: 'Avalanche',
          address: realNativeAddress,
        });
        expect(hasWrapped).rejects.toThrow();
      });

      test('Real Wrapped', async () => {
        const orig = await tb.getOriginalAsset(realWrappedAddress);
        const wrappedAsset = await tb.getWrappedAsset(orig);
        expect(wrappedAsset.toString()).toBe(realWrappedAddress.toString());
      });
    });
  });

  describe('Create Token Attestation Transactions', () => {
    const chain = 'Ethereum';
    const nativeAddress = testing.utils.makeNativeAddress(chain);

    const tbAddress = p.config[chain]!.contracts.tokenBridge!;

    test('Create Attestation', async () => {
      const attestation = tb.createAttestation(nativeAddress);
      const allTxns = [];
      for await (const atx of attestation) {
        allTxns.push(atx);
      }
      expect(allTxns).toHaveLength(1);
      const [attestTx] = allTxns;
      expect(attestTx).toBeTruthy();
      expect(attestTx.chain).toEqual(chain);

      const { transaction } = attestTx;
      expect(transaction.chainId).toEqual(
        nativeChainIds.networkChainToNativeChainId.get(network, chain),
      );
    });

    test('Submit Attestation', async () => {
      const vaa = createVAA('TokenBridge:AttestMeta', {
        payload: {
          token: { address: nativeAddress.toUniversalAddress(), chain: chain },
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
      const submitAttestation = tb.submitAttestation(vaa);

      const allTxns = [];
      for await (const atx of submitAttestation) {
        allTxns.push(atx);
      }
      expect(allTxns).toHaveLength(1);
      const [attestTx] = allTxns;
      expect(attestTx).toBeTruthy();
      expect(attestTx.chain).toEqual(chain);

      const { transaction } = attestTx;
      expect(transaction.chainId).toEqual(
        nativeChainIds.networkChainToNativeChainId.get(network, chain),
      );
    });
  });

  describe('Create TokenBridge Transactions', () => {
    const tbAddress = p.config[chain]!.contracts.tokenBridge!;

    describe('Token Transfer Transactions', () => {
      describe('Transfer', () => {
        const amount = 1000n;
        const payload: Uint8Array | undefined = undefined;

        test('Native', async () => {
          const token = 'native';
          const xfer = tb.transfer(sender, recipient, token, amount, payload);
          expect(xfer).toBeTruthy();

          const allTxns = [];
          for await (const tx of xfer) {
            allTxns.push(tx);
          }
          expect(allTxns).toHaveLength(1);

          const [xferTx] = allTxns;
          expect(xferTx).toBeTruthy();
          expect(xferTx.chain).toEqual(chain);

          const { transaction } = xferTx;
          expect(transaction.chainId).toEqual(
            nativeChainIds.networkChainToNativeChainId.get(network, chain),
          );
        });

        test('Token', async () => {
          const xfer = tb.transfer(
            sender,
            recipient,
            realWrappedAddress,
            amount,
            payload,
          );
          expect(xfer).toBeTruthy();

          const allTxns = [];
          for await (const tx of xfer) {
            allTxns.push(tx);
          }
          expect(allTxns).toHaveLength(2);

          const [approveTx, xferTx] = allTxns;
          expect(approveTx).toBeTruthy();
          const { transaction: approveTransaction } = approveTx;
          expect(approveTransaction.to).toEqual(realWrappedAddress.toString());

          expect(xferTx).toBeTruthy();
          expect(xferTx.chain).toEqual(chain);
          const { transaction: xferTransaction } = xferTx;
          expect(xferTransaction.to).toEqual(tbAddress.toString());
          expect(xferTransaction.chainId).toEqual(
            nativeChainIds.networkChainToNativeChainId.get(network, chain),
          );
        });
      });
    });
  });
});
