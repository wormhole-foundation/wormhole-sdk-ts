import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import { Wormhole } from '@wormhole-foundation/connect-sdk';
import { EvmPlatform } from '../../src/platform';
import { EvmChain, EvmTokenBridge } from '../../src';
import { Transaction } from 'ethers';

describe('Initialize Objects', () => {
  const wh = new Wormhole('Testnet', [EvmPlatform]);

  let ethCtx: EvmPlatform;
  test('Get Ethereum Context', () => {
    ethCtx = wh.getContext('Ethereum') as EvmPlatform;
    expect(ethCtx).toBeTruthy();
  });

  let tokenBridge: EvmTokenBridge;
  test('Get Ethereum Token Bridge', async () => {
    // TODO: We already asked for the `Ethereum` context, seems weird to
    // re-specify to get rpc/tokenbridge/etc...
    tokenBridge = await ethCtx.getTokenBridge('Ethereum');
    expect(tokenBridge).toBeTruthy();
  });

  test('Create Transfer Transaction', async () => {
    const ethAddy = new UniversalAddress(new Uint8Array(20));
    const solAddy = new UniversalAddress(new Uint8Array(32));

    const txgen = tokenBridge.transfer(
      ethAddy,
      ['Solana', solAddy],
      'native',
      1000n,
    );

    for await (const tx of txgen) {
      expect(tx).toBeTruthy();
      console.log(tx);
    }
  });
});
