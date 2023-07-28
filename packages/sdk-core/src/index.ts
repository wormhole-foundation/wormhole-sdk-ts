import TESTNET_CONFIG from './config/TESTNET';
import MAINNET_CONFIG from './config/MAINNET';
import * as SolanaWormhole from './anchor-idl/wormhole.json';
import * as SolanaTokenBridge from './anchor-idl/token_bridge.json';
import * as SolanaNftBridge from './anchor-idl/nft_bridge.json';

export type {
  TestnetChainId,
  TestnetChainName,
  ChainContracts as TestnetChainContracts,
  TESTNET_CHAINS,
} from './config/TESTNET';
export * from './config/MAINNET';
export const CONFIG = {
  MAINNET: MAINNET_CONFIG,
  TESTNET: TESTNET_CONFIG,
};

export * from './wormhole';
export * from './types';
export * from './explorer';
export * from './utils';

export { RelayerAbstract } from './abstracts/relayer';
export { ContractsAbstract } from './abstracts/contracts';
export { TokenBridgeAbstract } from './abstracts/tokenBridge';
export { SolanaAbstract } from './abstracts/contexts/solana';
export { SeiAbstract } from './abstracts/contexts/sei';

export * from './abis/TokenBridgeRelayer';
export * from './abis/TokenBridgeRelayer__factory';
export const SolanaContracts = {
  Wormhole: SolanaWormhole,
  TokenBridge: SolanaTokenBridge,
  NftBridge: SolanaNftBridge,
};
