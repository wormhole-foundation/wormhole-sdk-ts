import {
  CONFIG,
  DEFAULT_NETWORK,
  Signature,
  TokenBridge,
  UniversalAddress,
  createVAA,
  toNative,
} from '@wormhole-foundation/sdk-connect';
import { utils } from '@wormhole-foundation/sdk-definitions/testing';

import '@wormhole-foundation/sdk-solana-core';
import '@wormhole-foundation/sdk-solana-tokenbridge';

import {
  SolanaChains,
  SolanaPlatform,
  SolanaUnsignedTransaction,
  isVersionedTransaction,
} from './../../src/index.js';

import { describe, expect, test } from '@jest/globals';

import nock from 'nock';
import path from 'path';

const network = DEFAULT_NETWORK;
type TNet = typeof network;

const configs = CONFIG[network].chains;

// Should change the rpc at least in CI to one that is more permissive
// resets after 10s https://solana.com/docs/core/clusters#devnet-rate-limits
const waitForRateLimit = async (seconds: number = 10) =>
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));

const TOKEN_ADDRESSES = {
  Mainnet: {
    Solana: {
      wsol: 'So11111111111111111111111111111111111111112',
      wavax: 'KgV1GvrHQmRBY8sHQQeUKwTm2r2h8t4C8qt12Cw1HVE',
    },
  },
};
const senderAddress = '4ppT6RCHUHtCDuB51And9Ys8UgWMCq4KC5WEyzburwcU';

const bogusAddress = toNative(
  'Solana',
  'GvC3f13VUj1UiPpQY1myWpQsKNeu29jYJRfrLx5wfjHF',
);

const realNativeAddress = toNative(
  'Solana',
  // @ts-ignore
  TOKEN_ADDRESSES[network]['Solana']['wsol'],
);
const realWrappedAddress = toNative(
  'Solana',
  // @ts-ignore
  TOKEN_ADDRESSES[network]['Solana']['wavax'],
);

// Setup nock to record fixtures
const nockBack = nock.back;

nockBack.fixtures =
  (__dirname ?? path.resolve() + '/__tests__/integration') + '/fixtures';

let nockDone: () => void;
beforeEach(async () => {
  nockBack.setMode('lockdown');
  const fullTestName = expect.getState().currentTestName?.replace(/\s/g, '_');
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
  nockBack.setMode('wild');
});

describe('TokenBridge Tests', () => {
  const p = new SolanaPlatform(network, configs);

  let tb: TokenBridge<TNet, SolanaChains>;

  test('Create TokenBridge', async () => {
    const rpc = p.getRpc('Solana');
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
        // sleep so we dont hit rate limit
        await waitForRateLimit(15);
        const orig = await tb.getOriginalAsset(realWrappedAddress);
        const hasWrapped = await tb.hasWrappedAsset(orig);
        expect(hasWrapped).toBe(true);
      });
    });

    describe('getWrappedAsset', () => {
      test('Bogus', async () => {
        // sleep so we dont hit rate limit
        await waitForRateLimit();
        const hasWrapped = tb.getWrappedAsset({
          chain: 'Avalanche',
          address: bogusAddress,
        });
        expect(hasWrapped).rejects.toThrow();
      });

      test('Real Not Wrapped', async () => {
        // sleep so we dont hit rate limit
        await waitForRateLimit();
        const hasWrapped = tb.getWrappedAsset({
          chain: 'Avalanche',
          address: realNativeAddress,
        });
        expect(hasWrapped).rejects.toThrow();
      });

      test('Real Wrapped', async () => {
        // sleep so we dont hit rate limit
        await waitForRateLimit();
        const orig = await tb.getOriginalAsset(realWrappedAddress);
        const wrappedAsset = await tb.getWrappedAsset(orig);
        expect(wrappedAsset.toString()).toBe(realWrappedAddress.toString());
      });
    });
  });

  describe('Create Token Attestation Transactions', () => {
    const chain: 'Solana' = 'Solana';

    const sender = toNative(chain, senderAddress);
    const tbAddress = p.config[chain]!.contracts.tokenBridge!;

    test('Create Attestation', async () => {
      // sleep so we dont hit rate limit
      await waitForRateLimit();
      const attestation = tb.createAttestation(bogusAddress, sender);
      const allTxns: SolanaUnsignedTransaction<TNet>[] = [];
      for await (const atx of attestation) {
        allTxns.push(atx);
      }

      expect(allTxns).toHaveLength(1);
      const [attestTx] = allTxns;
      expect(attestTx).toBeTruthy();
      expect(attestTx!.chain).toEqual(chain);

      const { transaction } = attestTx!;
      if (isVersionedTransaction(transaction.transaction))
        throw new Error('Should not receive versioned transactions (yet)');
      expect(transaction.transaction.instructions).toHaveLength(2);
    });

    test('Submit Attestation', async () => {
      // sleep so we dont hit rate limit
      await waitForRateLimit();
      const vaa = createVAA('TokenBridge:AttestMeta', {
        payload: {
          token: {
            chain: 'Avalanche',
            address: new UniversalAddress('0x' + '0F'.repeat(32)),
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
      const submitAttestation = tb.submitAttestation(vaa, sender);

      const allTxns: SolanaUnsignedTransaction<TNet>[] = [];
      for await (const atx of submitAttestation) {
        allTxns.push(atx);
      }
      expect(allTxns).toHaveLength(3);

      const [_verifySig, _postVaa, _create] = allTxns;
      //

      const { transaction: verifySig } = _verifySig!;
      const { transaction: postVaa } = _postVaa!;
      const { transaction: create } = _create!;

      if (isVersionedTransaction(verifySig!.transaction))
        throw new Error('Should not receive versioned transactions (yet)');
      if (isVersionedTransaction(postVaa!.transaction))
        throw new Error('Should not receive versioned transactions (yet)');
      if (isVersionedTransaction(create!.transaction))
        throw new Error('Should not receive versioned transactions (yet)');

      expect(verifySig!.transaction.instructions).toHaveLength(2);
      expect(postVaa!.transaction.instructions).toHaveLength(1);
      expect(create!.transaction.instructions).toHaveLength(1);
    });
  });

  describe('Create TokenBridge Transactions', () => {
    const chain = 'Solana';
    const destChain = 'Ethereum';

    const sender = toNative(chain, senderAddress);
    const recipient = utils.makeUniversalChainAddress(destChain);

    const amount = 1000n;
    const payload: Uint8Array | undefined = undefined;

    describe('Token Transfer Transactions', () => {
      describe('Transfer', () => {
        test('Native', async () => {
          const token = 'native';
          const xfer = tb.transfer(sender, recipient, token, amount, payload);
          expect(xfer).toBeTruthy();

          const allTxns: SolanaUnsignedTransaction<TNet>[] = [];
          for await (const tx of xfer) {
            allTxns.push(tx);
          }
          expect(allTxns).toHaveLength(1);

          const [xferTx] = allTxns;
          expect(xferTx).toBeTruthy();
          expect(xferTx!.chain).toEqual(chain);

          const {
            transaction: { transaction },
          } = xferTx!;
          if (isVersionedTransaction(transaction))
            throw new Error('Should not receive versioned transactions (yet)');

          expect(transaction.instructions).toHaveLength(6);
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

          const allTxns: SolanaUnsignedTransaction<TNet>[] = [];
          for await (const tx of xfer) {
            allTxns.push(tx);
          }
          expect(allTxns).toHaveLength(1);

          const [xferTx] = allTxns;
          expect(xferTx).toBeTruthy();
          expect(xferTx!.chain).toEqual(chain);

          const {
            transaction: { transaction },
          } = xferTx!;
          if (isVersionedTransaction(transaction))
            throw new Error('Should not receive versioned transactions (yet)');
          expect(transaction.instructions).toHaveLength(2);
        });
      });
    });
  });
});
