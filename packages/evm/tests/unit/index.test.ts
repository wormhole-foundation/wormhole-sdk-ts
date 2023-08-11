import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import { EvmContext } from '../../src/context';
import { ethers } from 'ethers';

async function createContext(): Promise<EvmContext> {
  const url = 'https://rpc.ankr.com/eth';
  const provider = new ethers.JsonRpcProvider(url);
  return await EvmContext.fromProvider(provider);
}

test('Initializes', async () => {
  const ctx = await createContext();
  const addy = new UniversalAddress(new Uint8Array(32));
  console.log(await ctx.transfer(addy, ['Solana', addy], 'native', 1000n));
});
