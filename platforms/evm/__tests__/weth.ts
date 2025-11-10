import { wormhole } from '@wormhole-foundation/sdk';
import { Network, platformToChains } from '@wormhole-foundation/sdk-connect';
import evm from '@wormhole-foundation/sdk/evm';
import { EvmChains, WETH_CONTRACTS } from '@wormhole-foundation/sdk-evm';

describe('WETH contracts', function () {
  const evmChains = platformToChains('Evm');

  for (const chain of evmChains) {
    it(`has correct Mainnet WETH contract for ${chain}`, async () => {
      await testWethContracts('Mainnet', chain);
    });
    it(`has correct Testnet WETH contract for ${chain}`, async () => {
      await testWethContracts('Testnet', chain);
    });
  }

  const testWethContracts = async (network: Network, evmChain: EvmChains) => {
    const wethConst = WETH_CONTRACTS[network]?.[evmChain];
    if (wethConst === undefined) {
      return;
    }

    const wh = await wormhole(network, [evm]);
    const chain = wh.getChain(evmChain);

    try {
      const tb = await chain.getTokenBridge();
      /* @ts-ignore */
      const wethLive = await tb.tokenBridge!.WETH();
      expect(wethConst).toBeTruthy();
      expect(wethConst).toEqual(wethLive);
    } catch (e: any) {
      if (
        /Token Bridge contract.*not found/.test(e.message) ||
        e.message.includes('No configuration available') // No RPC found for this combo of (network, chain)
      ) {
        // Since we have some single-network chains like Sepolia and Ethereum
        // and others like Blast which correspond to both, we have to just catch
        // this error.
      } else if (e.message.includes('server response')) {
        // RPC aint working
        console.error(
          `Failed to make RPC call to verify WETH contract for ${network} ${evmChain}: ${e.message}`,
        );
      } else {
        // Testnet RPCs can be flaky, but Mainnet should be more reliable
        // TODO: remove Monad exception when its mainnet RPC is enabled
        if (network === 'Mainnet' && evmChain !== 'Monad') {
          throw e;
        }
        console.warn(
          `Skipping flaky testnet WETH contract test for ${network} ${evmChain}: ${e.message}`,
        );
      }
    }
  };
});
