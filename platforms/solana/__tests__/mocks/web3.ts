import { nativeChainIds } from '@wormhole-foundation/connect-sdk';

// Mock the genesis hash call for solana so we dont touch the network
jest.mock('@solana/web3.js', () => {
  const actualWeb3 = jest.requireActual('@solana/web3.js');
  return {
    ...actualWeb3,
    getDefaultProvider: jest.fn().mockImplementation(() => {
      return {
        getGenesisHash: jest
          .fn()
          .mockReturnValue(nativeChainIds.networkChainToNativeChainId('Mainnet', 'Solana')),
      };
    }),
  };
});
