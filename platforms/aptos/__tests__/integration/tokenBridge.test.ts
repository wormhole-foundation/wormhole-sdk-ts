import {
  TokenBridge,
  testing,
  toNative,
  Signature,
  CONFIG,
  DEFAULT_NETWORK,
  createVAA,
} from '@wormhole-foundation/connect-sdk';

import '@wormhole-foundation/connect-sdk-aptos-core'
import '@wormhole-foundation/connect-sdk-aptos-tokenbridge'


import {
  AptosUnsignedTransaction,
  AptosPlatform,
  APTOS_COIN,
} from '../../src/';

import { expect, describe, test } from '@jest/globals';

import nock from 'nock';

const network = DEFAULT_NETWORK;
const configs = CONFIG[network].chains;

const TOKEN_ADDRESSES = {
  Mainnet: {
    Aptos: {
      waptos: APTOS_COIN,
      wavax: "0xbe8f4301c0b54e870902b9a23eeb95ce74ac190531782aa3262337ceb145401a::coin::T"
    },
  },
};

const senderAddress = testing.utils.makeNativeAddress('Aptos');
const bogusAddress = testing.utils.makeNativeAddress('Aptos');
const realNativeAddress = toNative(
  'Aptos',
  TOKEN_ADDRESSES["Mainnet"]['Aptos']['waptos'],
);
const realWrappedAddress = toNative(
  'Aptos',
  TOKEN_ADDRESSES["Mainnet"]['Aptos']['wavax'],
);

// Setup nock to record fixtures
const nockBack = nock.back;
nockBack.fixtures = __dirname + '/fixtures';

let nockDone: () => void;
beforeEach(async () => {
  nockBack.setMode('update');
  const fullTestName = expect.getState().currentTestName?.replace(/\s/g, '_');
  const { nockDone: nd } = await nockBack(`${fullTestName}.json`, {
    // Remove the `id` from the request body after preparing it but before
    // trying to match a fixture.
    after: (scope) => {
      scope.filteringRequestBody((body: string) => {
        const o = JSON.parse(body) as { id?: string };
        if (o.id) delete o.id;
        return JSON.stringify(o);
      });
    },
    // Remove the `id` from the request body before saving it as a fixture.
    afterRecord: (defs) => {
      return defs.map((d: nock.Definition) => {
        const body = d.body as { id?: string };
        if (body.id) delete body.id;
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
  nockBack.setMode('wild');
});

describe('TokenBridge Tests', () => {
  const p: typeof AptosPlatform = AptosPlatform.setConfig(network, configs);

  let tb: TokenBridge<'Aptos'>;

  test('Create TokenBridge', async () => {
    const rpc = p.getRpc('Aptos');
    tb = await p.getTokenBridge(rpc);
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
    const chain = 'Aptos';
    const tbAddress = p.config[chain]!.contracts.tokenBridge!;

    test('Create Attestation', async () => {
      const attestation = tb.createAttestation(realNativeAddress, senderAddress);
      const allTxns: AptosUnsignedTransaction[] = [];
      for await (const atx of attestation) {
        allTxns.push(atx);
      }
      expect(allTxns).toHaveLength(1);

      const [attestTx] = allTxns;
      expect(attestTx).toBeTruthy();
      expect(attestTx.chain).toEqual(chain);

      const { transaction } = attestTx;
      expect(transaction.arguments).toHaveLength(0);
    });

    test('Submit Attestation', async () => {
      const vaa = createVAA('TokenBridge:AttestMeta', {
        payload: {
          token: {
            address: realNativeAddress.toUniversalAddress(),
            chain: 'Avalanche',
          },
          decimals: 8,
          symbol: Buffer.from(new Uint8Array(16)).toString('hex'),
          name: Buffer.from(new Uint8Array(16)).toString('hex'),
        },
        guardianSet: 3,
        signatures: [{ guardianIndex: 0, signature: new Signature(1n, 2n, 1) }],
        emitterChain: 'Avalanche',
        emitterAddress: toNative(chain, tbAddress).toUniversalAddress(),
        sequence: 0n,
        consistencyLevel: 0,
        timestamp: 0,
        nonce: 0,
      });
      const submitAttestation = tb.submitAttestation(vaa, senderAddress);

      const allTxns: AptosUnsignedTransaction[] = [];
      for await (const atx of submitAttestation) {
        allTxns.push(atx);
      }
      expect(allTxns).toHaveLength(2);
    });
  });

  describe('Create TokenBridge Transactions', () => {
    const chain = 'Aptos';
    const destChain = 'Ethereum';

    const recipient = testing.utils.makeChainAddress(destChain);

    const amount = 1000n;
    const payload: Uint8Array | undefined = undefined;

    describe('Token Transfer Transactions', () => {
      describe('Transfer', () => {
        test('Native', async () => {
          const token = 'native';
          const xfer = tb.transfer(senderAddress, recipient, token, amount, payload);
          expect(xfer).toBeTruthy();

          const allTxns: AptosUnsignedTransaction[] = [];
          for await (const tx of xfer) {
            allTxns.push(tx);
          }
          expect(allTxns).toHaveLength(1);

          const [xferTx] = allTxns;
          expect(xferTx).toBeTruthy();
          expect(xferTx.chain).toEqual(chain);

          const { transaction } = xferTx;
          expect(transaction.arguments).toHaveLength(5);
          // ...
        });

        test('Token', async () => {
          const xfer = tb.transfer(
            senderAddress,
            recipient,
            realWrappedAddress,
            amount,
            payload,
          );
          expect(xfer).toBeTruthy();

          const allTxns: AptosUnsignedTransaction[] = [];
          for await (const tx of xfer) {
            allTxns.push(tx);
          }
          expect(allTxns).toHaveLength(1);

          const [xferTx] = allTxns;
          expect(xferTx).toBeTruthy();
          expect(xferTx.chain).toEqual(chain);

          const { transaction } = xferTx;
          expect(transaction.type_arguments).toHaveLength(1);
          expect(transaction.arguments).toHaveLength(5);
        });
      });
    });
  });
});
