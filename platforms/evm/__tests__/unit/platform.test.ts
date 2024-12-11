import { jest, expect, test } from '@jest/globals';

jest.mock('ethers', () => {
  const actualEthers = jest.requireActual('ethers');
  return {
    __esModule: true,
    ...(actualEthers as any),
    getDefaultProvider: jest.fn().mockImplementation(() => {
      return {
        getNetwork: jest.fn().mockReturnValue({ chainId: 1 }),
      };
    }),
  };
});

import {
  CONFIG,
  DEFAULT_NETWORK,
  chainToPlatform,
  chains,
} from '@wormhole-foundation/sdk-connect';

import {
  toNative,
} from '@wormhole-foundation/sdk-definitions';

import '@wormhole-foundation/sdk-evm-core';
import '@wormhole-foundation/sdk-evm-tokenbridge';
import { EvmPlatform } from '../../src/platform.js';

const ethers = jest.requireMock('ethers') as { getDefaultProvider: jest.Mock };
import { EvmChains } from './../../src/index.js';

const EVM_CHAINS = chains.filter(
  (c) => chainToPlatform(c) === EvmPlatform._platform,
) as EvmChains[];

const network = DEFAULT_NETWORK;
const configs = CONFIG[network].chains;

// TODO:
// const satisfiesInterface: PlatformUtils<typeof network> = EvmPlatform;

describe('EVM Platform Tests', () => {
  describe("Parse Ethereum address", function () {
    test("should correctly parse Ethereum addresses", () => {
      expect(() =>
        toNative('Ethereum', '0xaaee1a9723aadb7afa2810263653a34ba2c21c7a')
      ).toBeTruthy();
    });

    test("should correctly handle zero-padded Ethereum addresses (in universal address format)", () => {
      expect(() =>
        toNative('Ethereum', '0x000000000000000000000000aaee1a9723aadb7afa2810263653a34ba2c21c7a')
      ).toBeTruthy();
    });

    test("should throw when parsing an invalid Ethereum addresses", () => {
      expect(() =>
        toNative('Ethereum', '0xabd62c91e3bd89243c592b93b9f45cf9f584be3df4574e05ae31d02fcfef67fc')
      ).toThrow();
    });
  });

  describe('Get Token Bridge', () => {
    test('No RPC', async () => {
      const p = new EvmPlatform(network, {});
      const rpc = ethers.getDefaultProvider('');
      expect(() => p.getProtocol('TokenBridge', rpc)).rejects.toThrow();
    });
    test('With RPC', async () => {
      const p = new EvmPlatform(network, {
        [EVM_CHAINS[0]!]: configs[EVM_CHAINS[0]!],
      });

      const rpc = ethers.getDefaultProvider('');
      const tb = await p.getProtocol('TokenBridge', rpc);
      expect(tb).toBeTruthy();
    });
  });

  describe('Get Automatic Token Bridge', () => {
    test('No RPC', async () => {
      const p = new EvmPlatform(network, {});
      expect(() =>
        p.getProtocol('AutomaticTokenBridge', undefined),
      ).rejects.toThrow();
    });
    test('With RPC', async () => {
      const p = new EvmPlatform(network, {
        [EVM_CHAINS[0]!]: configs[EVM_CHAINS[0]!],
      });
      const rpc = ethers.getDefaultProvider('');
      const tb = await p.getProtocol('AutomaticTokenBridge', rpc);
      expect(tb).toBeTruthy();
    });
  });

  describe('Get Chain', () => {
    test('No conf', () => {
      const p = new EvmPlatform(network, {});
      expect(p.config).toEqual({});
      expect(() => p.getChain(EVM_CHAINS[0]!)).toThrow();
    });

    test('With conf', () => {
      const p = new EvmPlatform(network, {
        [EVM_CHAINS[0]!]: configs[EVM_CHAINS[0]!],
      });
      expect(() => p.getChain(EVM_CHAINS[0]!)).not.toThrow();
    });
  });

  describe('Get RPC Connection', () => {
    test('No conf', () => {
      const p = new EvmPlatform(network, {});
      expect(p.config).toEqual({});

      // expect getRpc to throw an error since we havent provided
      // the conf to figure out how to connect
      expect(() => p.getRpc(EVM_CHAINS[0]!)).toThrow();
    });

    test('With conf', () => {
      const p = new EvmPlatform(network, {
        [EVM_CHAINS[0]!]: configs[EVM_CHAINS[0]!],
      });
      const C = p.getChain(EVM_CHAINS[0]!);
      expect(() => p.getRpc(EVM_CHAINS[0]!)).not.toThrow();
      expect(() => C.getRpc()).not.toThrow();
    });
  });
});
