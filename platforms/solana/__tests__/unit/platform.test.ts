import { jest, expect, test } from '@jest/globals';
import { nativeChainIds } from '@wormhole-foundation/sdk-connect';

// Mock the genesis hash call for solana so we dont touch the network
jest.mock('@solana/web3.js', () => {
  const actualWeb3 = jest.requireActual('@solana/web3.js');
  return {
    ...(actualWeb3 as any),
    getDefaultProvider: jest.fn().mockImplementation(() => {
      return {
        getGenesisHash: jest
          .fn()
          .mockReturnValue(
            nativeChainIds.networkChainToNativeChainId('Mainnet', 'Solana'),
          ),
      };
    }),
  };
});

import {
  DEFAULT_NETWORK,
  CONFIG,
  chainToPlatform,
  chains,
} from '@wormhole-foundation/sdk-connect';

import { SolanaChains, SolanaPlatform } from './../../src/index.js';

import '@wormhole-foundation/sdk-solana-core';
import '@wormhole-foundation/sdk-solana-tokenbridge';

const { getDefaultProvider } = jest.requireMock('@solana/web3.js') as {
  getDefaultProvider: jest.Mock;
};

const network = DEFAULT_NETWORK;

const SOLANA_CHAINS = chains.filter(
  (c) => chainToPlatform(c) === SolanaPlatform._platform,
) as SolanaChains[];

const configs = CONFIG[network].chains;

describe('Solana Platform Tests', () => {
  const fakeRpc = getDefaultProvider();

  describe('Get Token Bridge', () => {
    test('Hardcoded Genesis mock', async () => {
      const p = new SolanaPlatform(network, {
        [SOLANA_CHAINS[0]!]: configs[SOLANA_CHAINS[0]!],
      });

      const tb = await p.getProtocol('TokenBridge', fakeRpc);
      expect(tb).toBeTruthy();
    });
  });

  describe('Get Chain', () => {
    test('No conf', () => {
      const p = new SolanaPlatform(network, {});
      expect(p.config).toEqual({});
      expect(() => p.getChain(SOLANA_CHAINS[0]!)).toThrow();
    });

    test('With conf', () => {
      const p = new SolanaPlatform(network, {
        [SOLANA_CHAINS[0]!]: configs[SOLANA_CHAINS[0]!],
      });
      expect(() => p.getChain(SOLANA_CHAINS[0]!)).not.toThrow();
    });
  });

  describe('Get RPC Connection', () => {
    test('No conf', () => {
      const p = new SolanaPlatform(network, {});
      expect(p.config).toEqual({});

      // expect getRpc to throw an error since we havent provided
      // the conf to figure out how to connect
      expect(() => p.getRpc(SOLANA_CHAINS[0]!)).toThrow();
      expect(() => p.getChain(SOLANA_CHAINS[0]!)).toThrow();
    });

    test('With conf', () => {
      const p = new SolanaPlatform(network, {
        [SOLANA_CHAINS[0]!]: configs[SOLANA_CHAINS[0]!],
      });
      expect(() => p.getRpc(SOLANA_CHAINS[0]!)).not.toThrow();
      expect(() => p.getChain(SOLANA_CHAINS[0]!).getRpc()).not.toThrow();
    });
  });
});
