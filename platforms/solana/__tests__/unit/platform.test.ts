import { expect, test } from '@jest/globals';
import '../mocks/web3';

import {
  testing,
  ChainName,
  chainToPlatform,
  chains,
  chainConfigs,
  supportsTokenBridge,
} from '@wormhole-foundation/connect-sdk';

import { SolanaPlatform } from '../../src';

import { PublicKey } from '@solana/web3.js';

// @ts-ignore -- this is the mock we import above
import { getDefaultProvider } from '@solana/web3.js';

const SOLANA_CHAINS = chains.filter((c) => chainToPlatform(c) === 'Solana');
const configs = chainConfigs('Mainnet');

describe('Solana Platform Tests', () => {
  describe('Parse Address', () => {
    const p = SolanaPlatform.setConfig({});
    test.each(SOLANA_CHAINS)('Parses Address for %s', (chain: ChainName) => {
      const address = testing.utils.makeNativeAddressHexString(chain);
      const parsed = p.parseAddress(chain, address);
      expect(parsed).toBeTruthy();

      const encoded = new PublicKey(parsed.toUint8Array());
      expect(parsed.toUint8Array()).toEqual(encoded.toBytes());
    });
  });

  const fakeRpc = getDefaultProvider();

  describe('Get Token Bridge', () => {
    test('Hardcoded Genesis mock', async () => {
      const p = SolanaPlatform.setConfig({
        [SOLANA_CHAINS[0]]: configs[SOLANA_CHAINS[0]],
      });

      if (!supportsTokenBridge(p))
        throw new Error('Platform does not support TokenBridge');

      const tb = await p.getTokenBridge(fakeRpc);
      expect(tb).toBeTruthy();
    });
  });

  //describe('Get Automatic Token Bridge', () => {
  //  test('Fails until implemented', async () => {
  //    const p = SolanaPlatform.setConfig({
  //      [SOLANA_CHAINS[0]]: configs[SOLANA_CHAINS[0]],
  //    });
  //    expect(() => p.getAutomaticTokenBridge(fakeRpc)).rejects.toThrow();
  //  });
  //});

  describe('Get Chain', () => {
    test('No conf', () => {
      // no issues just grabbing the chain
      const p = SolanaPlatform.setConfig({});
      expect(p.conf).toEqual({});
      const c = p.getChain(SOLANA_CHAINS[0]);
      expect(c).toBeTruthy();
    });

    test('With conf', () => {
      const p = SolanaPlatform.setConfig({
        [SOLANA_CHAINS[0]]: configs[SOLANA_CHAINS[0]],
      });
      expect(() => p.getChain(SOLANA_CHAINS[0])).not.toThrow();
    });
  });

  describe('Get RPC Connection', () => {
    test('No conf', () => {
      const p = SolanaPlatform.setConfig({});
      expect(p.conf).toEqual({});

      // expect getRpc to throw an error since we havent provided
      // the conf to figure out how to connect
      expect(() => p.getRpc(SOLANA_CHAINS[0])).toThrow();
      expect(() => p.getChain(SOLANA_CHAINS[0]).getRpc()).toThrow();
    });

    test('With conf', () => {
      const p = SolanaPlatform.setConfig({
        [SOLANA_CHAINS[0]]: {
          rpc: 'http://localhost:8545',
        },
      });
      expect(() => p.getRpc(SOLANA_CHAINS[0])).not.toThrow();
      expect(() => p.getChain(SOLANA_CHAINS[0]).getRpc()).not.toThrow();
    });
  });
});
