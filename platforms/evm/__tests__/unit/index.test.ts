import {
  TokenTransferTransaction,
  Wormhole,
  TokenTransfer,
  TransactionIdentifier,
} from '@wormhole-foundation/connect-sdk';
import { EvmPlatform } from '../../src/platform';
import { EvmChain, EvmTokenBridge } from '../../src';
import { TokenBridge } from '@wormhole-foundation/sdk-definitions';

describe('Initialize Objects', () => {
  const wh = new Wormhole('Testnet', [EvmPlatform]);

  let ethCtx: EvmChain;
  test('Get Ethereum Context', () => {
    ethCtx = wh.getChain('Celo') as EvmChain;
    expect(ethCtx).toBeTruthy();
  });

  let tokenBridge: TokenBridge<'Evm'>;
  test('Get Ethereum Token Bridge', async () => {
    // TODO: We already asked for the `Ethereum` context, seems weird to
    // re-specify to get rpc/tokenbridge/etc...
    tokenBridge = await ethCtx.getTokenBridge();
    expect(tokenBridge).toBeTruthy();
  });

  test('Recover Transfer Details', async () => {
    const txs = await ethCtx.getTransaction(
      '0xb7677fabbe96e2caf10fdc14a3c971e60ff49458e83528c2594d87a7238af838',
    );
    expect(txs.length).toBe(1);

    const tx: TokenTransferTransaction = txs[0];
    expect(tx.details.amount).toBe(0n);
    expect(tx.details.from.chain).toBe('Celo');
  });

  test('Recover Wormhole Transfer', async () => {
    const txident: TransactionIdentifier = {
      chain: 'Celo',
      txid: '0xb7677fabbe96e2caf10fdc14a3c971e60ff49458e83528c2594d87a7238af838',
    };
    const tx = await TokenTransfer.from(wh, txident);
    expect(tx).toBeTruthy();
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
