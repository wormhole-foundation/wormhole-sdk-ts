import { Wormhole, TokenTransfer } from '@wormhole-foundation/connect-sdk';
import { SolanaPlatform } from '../../src/platform';
import { SolanaChain, SolanaTokenBridge } from '../../src';
import {
  TransactionId,
  TokenBridge,
} from '@wormhole-foundation/sdk-definitions';

describe('Initialize Objects', () => {
  const wh = new Wormhole('Testnet', [SolanaPlatform]);

  let solCtx: SolanaChain;
  test('Get Solana Context', () => {
    solCtx = wh.getChain('Solana') as SolanaChain;
    expect(solCtx).toBeTruthy();
  });

  // let tokenBridge: TokenBridge<'Solana'>;
  // test('Get Solana Token Bridge', async () => {
  //   // TODO: We already asked for the `Ethereum` context, seems weird to
  //   // re-specify to get rpc/tokenbridge/etc...
  //   tokenBridge = await solCtx.getTokenBridge();
  //   expect(tokenBridge).toBeTruthy();
  // });

  test('Recover Transfer Message ID', async () => {
    const msgIds = await solCtx.parseTransaction(
      'K5ApVaswLZf9CeNKzG53zq95Q3SxnQKuA6Nx1W4vGcMz9TsfCcAPMjXq8wt1r6GVw7aowSs7kUR5QzeHB6dffkU',
    );
    expect(msgIds.length).toBe(1);
    expect(msgIds[0].chain).toEqual('Solana');
    expect(msgIds[0].sequence).toBeGreaterThan(0);
  });

  // test('Recover Wormhole Transfer', async () => {
  //   const txident: TransactionId = {
  //     chain: 'Celo',
  //     txid: '0xb7677fabbe96e2caf10fdc14a3c971e60ff49458e83528c2594d87a7238af838',
  //   };
  //   const tx = await TokenTransfer.from(wh, txident);
  //   expect(tx).toBeTruthy();
  // });

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
