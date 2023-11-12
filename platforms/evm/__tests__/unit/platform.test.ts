import { expect, test } from '@jest/globals';
import '../mocks/ethers';

import {
  CONFIG,
  DEFAULT_NETWORK,
  chainToPlatform,
  chains
} from '@wormhole-foundation/connect-sdk';

import '@wormhole-foundation/connect-sdk-evm-core';
import '@wormhole-foundation/connect-sdk-evm-tokenbridge';
import { EvmPlatform } from '../../src/platform';

import { getDefaultProvider } from 'ethers';
import { EvmChains } from '../../src';


const EVM_CHAINS = chains.filter(
  (c) => chainToPlatform(c) === EvmPlatform._platform,
) as EvmChains[];

const network = DEFAULT_NETWORK;
const configs = CONFIG[network].chains;

// TODO:
// const satisfiesInterface: PlatformUtils<typeof network> = EvmPlatform;

describe('EVM Platform Tests', () => {
  describe('Get Token Bridge', () => {
    test('No RPC', async () => {
      const p = new EvmPlatform(network, {});
      const rpc = getDefaultProvider('');
      expect(() => p.getProtocol("TokenBridge", rpc)).rejects.toThrow();
    });
    test('With RPC', async () => {
      const p = new EvmPlatform(network, {
        [EVM_CHAINS[0]]: configs[EVM_CHAINS[0]],
      });

      const rpc = getDefaultProvider('');
      const tb = await p.getProtocol("TokenBridge", rpc);
      expect(tb).toBeTruthy();
    });
  });

  describe('Get Automatic Token Bridge', () => {
    test('No RPC', async () => {
      const p = new EvmPlatform(network, {});
      const rpc = getDefaultProvider('');
      expect(() => p.getProtocol("AutomaticTokenBridge", rpc)).rejects.toThrow();
    });
    test('With RPC', async () => {
      const p = new EvmPlatform(network, {
        [EVM_CHAINS[0]]: configs[EVM_CHAINS[0]],
      });
      const rpc = getDefaultProvider('');
      const tb = await p.getProtocol("AutomaticTokenBridge", rpc);
      expect(tb).toBeTruthy();
    });
  });

  describe('Get Chain', () => {
    test('No conf', () => {
      const p = new EvmPlatform(network, {});
      expect(p.config).toEqual({});
      expect(() => p.getChain(EVM_CHAINS[0])).toThrow();
    });

    test('With conf', () => {
      const p = new EvmPlatform(network, {
        [EVM_CHAINS[0]]: configs[EVM_CHAINS[0]],
      });
      expect(() => p.getChain(EVM_CHAINS[0])).not.toThrow();
    });
  });

  describe('Get RPC Connection', () => {
    test('No conf', () => {
      const p = new EvmPlatform(network, {});
      expect(p.config).toEqual({});

      // expect getRpc to throw an error since we havent provided
      // the conf to figure out how to connect
      expect(() => p.getRpc(EVM_CHAINS[0])).toThrow();
    });

    test('With conf', () => {
      const p = new EvmPlatform(network, {
        [EVM_CHAINS[0]]: configs[EVM_CHAINS[0]],
      });
      const C = p.getChain(EVM_CHAINS[0]);
      expect(() => p.getRpc(EVM_CHAINS[0])).not.toThrow();
      expect(() => C.getRpc()).not.toThrow();
    });
  });
});
