import { expect, test } from '@jest/globals';
import '../mocks/ethers';

import {
  ChainName,
  chainToPlatform,
  chains,
  chainConfigs,
  testing,
  DEFAULT_NETWORK,
} from '@wormhole-foundation/connect-sdk';
import { EvmPlatform } from '../../src/platform';

import { getDefaultProvider } from 'ethers';

const EVM_CHAINS = chains.filter(
  (c) => chainToPlatform(c) === EvmPlatform.platform,
);

const network = DEFAULT_NETWORK;
const configs = chainConfigs(network);

describe('EVM Platform Tests', () => {
  describe('Get Token Bridge', () => {
    test('No RPC', async () => {
      const p = EvmPlatform.setConfig(network, {});
      const rpc = getDefaultProvider('');
      expect(() => p.getTokenBridge(rpc)).rejects.toThrow();
    });
    test('With RPC', async () => {
      const p = EvmPlatform.setConfig(network, {
        [EVM_CHAINS[0]]: configs[EVM_CHAINS[0]],
      });

      const rpc = getDefaultProvider('');
      const tb = await p.getTokenBridge(rpc);
      expect(tb).toBeTruthy();
    });
  });

  describe('Get Automatic Token Bridge', () => {
    test('No RPC', async () => {
      const p = EvmPlatform.setConfig(network, {});
      const rpc = getDefaultProvider('');
      expect(() => p.getAutomaticTokenBridge(rpc)).rejects.toThrow();
    });
    test('With RPC', async () => {
      const p = EvmPlatform.setConfig(network, {
        [EVM_CHAINS[0]]: configs[EVM_CHAINS[0]],
      });

      const rpc = getDefaultProvider('');
      const tb = await p.getAutomaticTokenBridge(rpc);
      expect(tb).toBeTruthy();
    });
  });

  describe('Get Chain', () => {
    test('No conf', () => {
      const p = EvmPlatform.setConfig(network, {});
      expect(p.conf).toEqual({});
      expect(() => p.getChain(EVM_CHAINS[0])).toThrow();
    });

    test('With conf', () => {
      const p = EvmPlatform.setConfig(network, {
        [EVM_CHAINS[0]]: configs[EVM_CHAINS[0]],
      });
      expect(() => p.getChain(EVM_CHAINS[0])).not.toThrow();
    });
  });

  describe('Get RPC Connection', () => {
    test('No conf', () => {
      const p = EvmPlatform.setConfig(network, {});
      expect(p.conf).toEqual({});

      // expect getRpc to throw an error since we havent provided
      // the conf to figure out how to connect
      expect(() => p.getRpc(EVM_CHAINS[0])).toThrow();
    });

    test('With conf', () => {
      const p = EvmPlatform.setConfig(network, {
        [EVM_CHAINS[0]]: configs[EVM_CHAINS[0]],
      });
      const C = p.getChain(EVM_CHAINS[0]);
      expect(() => p.getRpc(EVM_CHAINS[0])).not.toThrow();
      expect(() => C.getRpc()).not.toThrow();
    });
  });
});
