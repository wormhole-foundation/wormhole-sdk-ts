import { Wormhole, TokenTransfer } from '@wormhole-foundation/connect-sdk';
import { SolanaPlatform } from '../../src/platform';
import { SolanaAddress, SolanaChain, SolanaTokenBridge } from '../../src';
import {
  TokenBridge,
  ChainAddress,
  UniversalAddress,
  TokenId,
} from '@wormhole-foundation/sdk-definitions';
import { MockSolanaSigner } from '../mocks/MockSigner';

const WETH_ADDRESS = '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6';

describe('Solana Unit Tests (not really unit tests)', () => {
  const sender = new MockSolanaSigner();
  const receiver = new MockSolanaSigner();

  const from: ChainAddress = {
    chain: sender.chain(),
    address: new SolanaAddress(sender.address()),
  };
  const to: ChainAddress = {
    chain: receiver.chain(),
    address: new SolanaAddress(receiver.address()),
  };

  const wh = new Wormhole('Testnet', [SolanaPlatform]);

  let solCtx: SolanaChain;
  let tokenBridge: TokenBridge<'Solana'>;

  describe('Initializes Objects', () => {
    test('Get Solana Context', () => {
      solCtx = wh.getChain('Solana') as SolanaChain;
      expect(solCtx).toBeTruthy();
    });

    test('Get Solana Token Bridge', async () => {
      tokenBridge = await solCtx.getTokenBridge();
      expect(tokenBridge).toBeTruthy();
    });
  });

  let solWrappedEth: SolanaAddress;
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
    // test('Create Token Transfer', async () => {
    //   xfer = await wh.tokenTransfer(
    //     { address: solWrappedEth, chain: 'Solana' },
    //     1_000_000_000n,
    //     from,
    //     to,
    //     false,
    //   );
    //   expect(xfer).toBeTruthy();
    //   const txids = await xfer.initiateTransfer(sender);
    //   expect(txids.length).toBeGreaterThan(0);
    // });

    test('Recover Transfer Message ID', async () => {
      const msgIds = await solCtx.parseTransaction(
        'K5ApVaswLZf9CeNKzG53zq95Q3SxnQKuA6Nx1W4vGcMz9TsfCcAPMjXq8wt1r6GVw7aowSs7kUR5QzeHB6dffkU',
      );
      expect(msgIds.length).toBe(1);
      expect(msgIds[0].chain).toEqual('Solana');
      expect(msgIds[0].sequence).toBeGreaterThan(0);
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
    //     console.log(tx);
    //   }
    // });
  });
});
