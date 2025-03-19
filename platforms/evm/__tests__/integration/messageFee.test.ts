import {
  CONFIG,
  DEFAULT_NETWORK,
} from '@wormhole-foundation/sdk-connect';

import '@wormhole-foundation/sdk-evm-core';
import '@wormhole-foundation/sdk-evm-tokenbridge';
import '@wormhole-foundation/sdk-evm-cctp';
import '@wormhole-foundation/sdk-evm-portico';
import { EvmPlatform } from './../../src/index.js';

import { describe, expect, test } from '@jest/globals';
import path from 'path';
import nock from 'nock';
import { toNative } from '@wormhole-foundation/sdk';
import { ethers } from 'ethers';
  
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

const dummyAddress = toNative('Ethereum', '0x0000000000000000000000000000000000000000');
const tokenAddress = toNative('Ethereum', '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0');

const transferAmount = 1000000000000000000n;

describe('Message Fee Tests', () => {

  const p = new EvmPlatform(network, configs);
  const chain = p.getChain('Ethereum', new ethers.JsonRpcProvider('https://virginia.rpc.blxrbdn.com'));

  describe('Core', () => {
    test('Publish Message', async () => {
      const core = await chain.getWormholeCore()
      const txs = core.publishMessage(
        dummyAddress,
        new Uint8Array(),
        0,
        0
      )
      const allTxs = []

      for await (const tx of txs) {
        allTxs.push(tx)
      }
      const tx = allTxs.find(tx => tx.description === 'WormholeCore.publishMessage')
      expect(allTxs.length).toBe(1)
      expect(tx?.transaction.value).not.toBeUndefined()
    })
  })

  describe('Token Bridge', () => {
    test('Create Attestation', async () => {
      const tb = await chain.getTokenBridge()
      const txs = tb.createAttestation(dummyAddress)
      const allTxs = []
      for await (const tx of txs) {
        allTxs.push(tx)
      }
      const tx = allTxs.find(tx => tx.description === 'TokenBridge.createAttestation')
      expect(allTxs.length).toBe(1)
      expect(tx?.transaction.value).not.toBeUndefined()
    })

    test('Transfer tokens with payload', async () => {
      const tb = await chain.getTokenBridge()
      const txs = tb.transfer(
        dummyAddress,
        {
          chain: 'Ethereum',
          address: dummyAddress
        },
        tokenAddress,
        transferAmount,
        new Uint8Array()
      )
      const allTxs = []
      for await (const tx of txs) {
        allTxs.push(tx)
      }
      const tx = allTxs.find(tx => tx.description === 'TokenBridge.transferTokensWithPayload')
      expect(allTxs.length).toBe(2)
      expect(tx?.transaction.value).not.toBeUndefined()
    })

    test('Transfer tokens without payload', async () => {
      const tb = await chain.getTokenBridge()
      const txs = tb.transfer(
        dummyAddress,
        {
          chain: 'Ethereum',
          address: dummyAddress
        },
        tokenAddress,
        transferAmount
      )
      const allTxs = []
      for await (const tx of txs) {
        allTxs.push(tx)
      }
      const tx = allTxs.find(tx => tx.description === 'TokenBridge.transferTokens')
      expect(allTxs.length).toBe(2)
      expect(tx?.transaction.value).not.toBeUndefined()
    })

    test('Transfer tokens native with payload', async () => {
      const tb = await chain.getTokenBridge()
      const txs = tb.transfer(
        dummyAddress,
        {
          chain: 'Ethereum',
          address: dummyAddress
        },
        'native',
        transferAmount,
        new Uint8Array()
      )
      const allTxs = []
      for await (const tx of txs) {
        allTxs.push(tx)
      }
      const tx = allTxs.find(tx => tx.description === 'TokenBridge.wrapAndTransferETHWithPayload')
      expect(allTxs.length).toBe(1)
      expect(tx?.transaction.value).not.toBeUndefined()
    })

    test('Transfer tokens native without payload', async () => {
      const tb = await chain.getTokenBridge()
      const txs = tb.transfer(
        dummyAddress,
        {
          chain: 'Ethereum',
          address: dummyAddress
        },
        'native',
        transferAmount
      )
      const allTxs = []
      for await (const tx of txs) {
        allTxs.push(tx)
      }
      const tx = allTxs.find(tx => tx.description === 'TokenBridge.wrapAndTransferETH')
      expect(allTxs.length).toBe(1)
      expect(tx?.transaction.value).not.toBeUndefined()
    })
  })

  describe('Automatic Token Bridge', () => {

    test('Transfer tokens', async() => {
      const atb = await chain.getAutomaticTokenBridge()
      const txs = atb.transfer(
        dummyAddress,
        {
          chain: 'Ethereum',
          address: dummyAddress
        },
        tokenAddress,
        transferAmount
      )
      const allTxs = []
      for await (const tx of txs) {
        allTxs.push(tx)
      }
      const tx = allTxs.find(tx => tx.description === 'TokenBridgeRelayer.TransferTokensWithRelay')
      expect(allTxs.length).toBe(2)
      expect(tx?.transaction.value).not.toBeUndefined()
    })

    test('Transfer native tokens', async() => {
      const atb = await chain.getAutomaticTokenBridge()
      const txs = atb.transfer(
        dummyAddress,
        {
          chain: 'Ethereum',
          address: dummyAddress
        },
        'native',
        transferAmount
      )
      const allTxs = []
      for await (const tx of txs) {
        allTxs.push(tx)
      }
      const tx = allTxs.find(tx => tx.description === 'TokenBridgeRelayer.wrapAndTransferETHWithRelay')
      expect(allTxs.length).toBe(1)
      expect(tx?.transaction.value).not.toBeUndefined()
    })
  })

  describe('CCTP', () => {
    it('transfer', async() => {
      const cb = await chain.getAutomaticCircleBridge()
      const txs = cb.transfer(
        dummyAddress,
        {
          chain: 'Ethereum',
          address: dummyAddress
        },
        transferAmount
      )
      const allTxs = []
      for await (const tx of txs) {
        allTxs.push(tx)
      }
      const tx = allTxs.find(tx => tx.description === 'CircleRelayer.transfer')
      expect(allTxs.length).toBe(2)
      expect(tx?.transaction.value).not.toBeUndefined()
    })
  })

  describe('Portico', () => {
    it('transfer', async() => {
      const pb = await chain.getPorticoBridge()
      const txs = pb.transfer(
        dummyAddress,
        {
          chain: 'Ethereum',
          address: dummyAddress
        },
        tokenAddress,
        transferAmount,
        {
          chain: 'Ethereum',
          address: dummyAddress
        },
        dummyAddress.toNative().toString(),
        {
          swapAmounts: {
            minAmountStart: 1n,
            minAmountFinish: 1n
          },
          relayerFee: 0n
        }
      )
      const allTxs = []
      for await (const tx of txs) {
        allTxs.push(tx)
      }
      const tx = allTxs.find(tx => tx.description === 'PorticoBridge.Transfer')
      expect(allTxs.length).toBe(2)
      expect(tx?.transaction.value).not.toBeUndefined()
    })
  })
})
