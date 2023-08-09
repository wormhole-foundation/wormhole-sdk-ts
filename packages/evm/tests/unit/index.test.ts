import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import { EvmContext } from '../../src/context';
import { ethers } from 'ethers';

describe('EvmContextCreation', async () => {
  const url = 'https://rpc.ankr.com/eth';
  const provider = new ethers.JsonRpcProvider(url);
  const ctx = await EvmContext.fromProvider(provider);
  console.log(ctx.chain);

  const addy = new UniversalAddress('0x00');

  console.log(await ctx.transfer(addy, ['Solana', addy], 'native', 1000n));
});
