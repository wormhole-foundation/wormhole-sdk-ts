import { expect, test } from '@jest/globals';
import {
  ChainAddress,
  UniversalAddress,
  testing,
} from '@wormhole-foundation/sdk-definitions';
import {
  ChainName,
  chainToPlatform,
  chainToChainId,
  chains,
} from '@wormhole-foundation/sdk-base';
import { Wormhole, chainConfigs } from '@wormhole-foundation/connect-sdk';

import {
  SolanaChain,
  SolanaPlatform,
  SolanaUnsignedTransaction,
  SolanaTokenBridge,
} from '../../src';
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes';
import { Connection, PublicKey } from '@solana/web3.js';

// jest.mock('@solana/web3.js', () => {
//   const actualWeb3 = jest.requireActual('@solana/web3.js');
//   return {
//     ...actualWeb3,
//   };
// });

// const address = [
//   '4n4kd8bWSJvSzKfcyuQ8x3wKSx1QpyHhWv6J5sw3k4jY',
//   '381e7091ac594a3bd7abb17669998b1db134111b4dab9d2d5cc8e5ef5d279127',
// ];
const SOLANA_CHAINS = chains.filter((c) => chainToPlatform(c) === 'Solana');

const configs = chainConfigs('Mainnet');

describe('Solana Platform Tests', () => {
  describe('Parse Address', () => {
    const p = new SolanaPlatform({});
    test.each(SOLANA_CHAINS)('Parses Address for %s', (chain: ChainName) => {
      const address = testing.utils.makeNativeAddressHexString(chain);
      const parsed = p.parseAddress(chain, address);
      expect(parsed).toBeTruthy();

      const encoded = new PublicKey(parsed.toUint8Array());
      expect(parsed.toUint8Array()).toEqual(encoded.toBytes());
    });
  });

  describe('Get Token Bridge', () => {
    test('No RPC', async () => {
      const p = new SolanaPlatform({});

      const rpc = new Connection('http://localhost:8545');
      expect(() => p.getTokenBridge(rpc)).rejects.toThrow();
    });
    test('With RPC', async () => {
      const p = new SolanaPlatform({
        [SOLANA_CHAINS[0]]: configs[SOLANA_CHAINS[0]],
      });

      const rpc = p.getRpc(SOLANA_CHAINS[0]);
      const tb = await p.getTokenBridge(rpc);
      expect(tb).toBeTruthy();
    });
  });

  // describe('Get Automatic Token Bridge', () => {
  //   test('No RPC', async () => {
  //     const p = new SolanaPlatform({});
  //     const rpc = p.getRpc(SOLANA_CHAINS[0]);
  //     expect(() => p.getAutomaticTokenBridge(rpc)).rejects.toThrow();
  //   });
  //   test('With RPC', async () => {
  //     const p = new SolanaPlatform({
  //       [SOLANA_CHAINS[0]]: configs[SOLANA_CHAINS[0]],
  //     });

  //     const rpc = p.getRpc(SOLANA_CHAINS[0]);
  //     const tb = await p.getAutomaticTokenBridge(rpc);
  //     expect(tb).toBeTruthy();
  //   });
  // });

  describe('Get Chain', () => {
    test('No conf', () => {
      // no issues just grabbing the chain
      const p = new SolanaPlatform({});
      expect(p.conf).toEqual({});
      const c = p.getChain(SOLANA_CHAINS[0]);
      expect(c).toBeTruthy();
    });

    test('With conf', () => {
      const p = new SolanaPlatform({
        [SOLANA_CHAINS[0]]: configs[SOLANA_CHAINS[0]],
      });
      expect(() => p.getChain(SOLANA_CHAINS[0])).not.toThrow();
    });
  });

  describe('Get RPC Connection', () => {
    test('No conf', () => {
      const p = new SolanaPlatform({});
      expect(p.conf).toEqual({});

      // expect getRpc to throw an error since we havent provided
      // the conf to figure out how to connect
      expect(() => p.getRpc(SOLANA_CHAINS[0])).toThrow();
      expect(() => p.getChain(SOLANA_CHAINS[0]).getRpc()).toThrow();
    });

    test('With conf', () => {
      const p = new SolanaPlatform({
        [SOLANA_CHAINS[0]]: {
          rpc: 'http://localhost:8545',
        },
      });
      expect(() => p.getRpc(SOLANA_CHAINS[0])).not.toThrow();
      expect(() => p.getChain(SOLANA_CHAINS[0]).getRpc()).not.toThrow();
    });
  });
});
