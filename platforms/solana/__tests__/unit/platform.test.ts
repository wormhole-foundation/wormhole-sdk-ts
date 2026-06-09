import { jest, expect, test, describe } from '@jest/globals';
import { nativeChainIds } from '@wormhole-foundation/sdk-connect';
import type { SolanaChains } from './../../src/index.js';

// Mock the genesis hash call for solana so we don't touch the network.
// ESM requires unstable_mockModule (jest.mock isn't hoisted/usable under ESM) and the
// modules that consume the mock must be imported dynamically AFTER it is registered.
jest.unstable_mockModule('@solana/web3.js', () => {
  const actualWeb3 = jest.requireActual('@solana/web3.js') as any;
  return {
    ...actualWeb3,
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

const { DEFAULT_NETWORK, CONFIG, chainToPlatform, chains } = await import(
  '@wormhole-foundation/sdk-connect'
);
const { SolanaPlatform } = await import('./../../src/index.js');
await import('@wormhole-foundation/sdk-solana-core');
await import('@wormhole-foundation/sdk-solana-tokenbridge');

const { getDefaultProvider } = (await import('@solana/web3.js')) as any;

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
