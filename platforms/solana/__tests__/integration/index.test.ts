import { Wormhole, TokenTransfer } from '@wormhole-foundation/connect-sdk';
import {
  TokenBridge,
  ChainAddress,
  UniversalAddress,
  TokenId,
  NativeAddress,
  ChainContext,
} from '@wormhole-foundation/sdk-definitions';

import { SolanaPlatform } from '../../src/platform';
import { SolanaAddress, SolanaChain } from '../../src';
import { MockSolanaSigner } from '../mocks/MockSigner';

const WETH_ADDRESS = '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6';
const SOL_TB_EMITTER = '4yttKWzRoNYS2HekxDfcZYmfQqnVWpKiJ8eydYRuFRgs';

describe('Solana Unit Tests (not really unit tests)', () => {
  const sender = new MockSolanaSigner();
  const receiver = new MockSolanaSigner();

  const from: ChainAddress = {
    chain: sender.chain(),
    address: new SolanaAddress(sender.address()).toUniversalAddress(),
  };
  const to: ChainAddress = {
    chain: receiver.chain(),
    address: new SolanaAddress(receiver.address()).toUniversalAddress(),
  };

  let wh: Wormhole;
  let solCtx: ChainContext<'Solana'>;
  let tokenBridge: TokenBridge<'Solana'>;

  test('Setup', async () => {
    wh = new Wormhole('Testnet', [SolanaPlatform]);
    solCtx = wh.getChain('Solana') as SolanaChain;
    tokenBridge = await solCtx.getTokenBridge();
  });

  let solWrappedEth: NativeAddress<'Solana'>;
  describe('Get Token Details', () => {
    const wethAddressBytes = new Uint8Array(32);
    wethAddressBytes.set(
      Uint8Array.from(Buffer.from(WETH_ADDRESS.slice(2), 'hex')),
      12,
    );
    const wethAddress = new UniversalAddress(wethAddressBytes);
    const wethToken: TokenId = {
      chain: 'Ethereum',
      address: wethAddress,
    };

    test('hasWrapped for WEth', async () => {
      const hasWrapped = await tokenBridge.hasWrappedAsset(wethToken);
      expect(hasWrapped).toBeTruthy();
    });

    test('getWrapped for WEth', async () => {
      solWrappedEth = await tokenBridge.getWrappedAsset(wethToken);
      expect(solWrappedEth).toBeTruthy();
    });

    test('Lookup Original Asset', async () => {
      const orig = await tokenBridge.getOriginalAsset(solWrappedEth);
      expect(orig).toBeTruthy();
      expect(orig.chain).toEqual(wethToken.chain);
      expect(
        orig.address
          .toUniversalAddress()
          .equals(wethToken.address.toUniversalAddress()),
      );
    });
  });

  describe('Token Transfer Tests', () => {
    let xfer: TokenTransfer;
    test('Create Token Transfer Object', async () => {
      xfer = await wh.tokenTransfer('native', 1_000_000_000n, from, to, false);
      expect(xfer).toBeTruthy();
    });

    // test('Initiate Transfer', async () => {
    //   const txids = await xfer.initiateTransfer(sender);
    //   expect(txids.length).toBeGreaterThan(0);
    // });

    test('Recover Transfer Message ID', async () => {
      const solEmitter = new SolanaAddress(SOL_TB_EMITTER).toUniversalAddress();
      const msgIds = await solCtx.parseTransaction(
        '4PE9CWyUj5SZH2XcyV7HZjYtNHyPRb4qi1zRtPptw1yewst5A4H1zKfbGsFFhCTELga3HJmhGtK6gEmEiGeKopSH',
      );
      expect(msgIds.length).toBe(1);
      expect(msgIds[0].chain).toEqual('Solana');
      expect(msgIds[0].sequence).toBeGreaterThan(0);
      expect(msgIds[0].emitter.toUniversalAddress().equals(solEmitter)).toEqual(
        true,
      );
    });

    // test('Create Transfer Transaction', async () => {
    //   const ethAddy = new UniversalAddress(new Uint8Array(20));
    //   const solAddy = new UniversalAddress(new Uint8Array(32));

    //   const txgen = tokenBridge.transfer(
    //     ethAddy,
    //     ['Solana', solAddy],
    //     'native',
    //     1000n,
    //   );

    //   for await (const tx of txgen) {
    //     expect(tx).toBeTruthy();
    //   }
    // });
  });
});
