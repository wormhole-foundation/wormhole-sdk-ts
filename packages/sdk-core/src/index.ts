import TESTNET_CONFIG from './config/TESTNET.js';
import MAINNET_CONFIG from './config/MAINNET.js';
import * as SolanaWormhole from './anchor-idl/wormhole.json';
import * as SolanaTokenBridge from './anchor-idl/token_bridge.json';
import * as SolanaNftBridge from './anchor-idl/nft_bridge.json';

export type {
  TestnetChainId,
  TestnetChainName,
  ChainContracts as TestnetChainContracts,
  TESTNET_CHAINS,
} from './config/TESTNET.js';
export * from './config/MAINNET.js';
export const CONFIG = {
  MAINNET: MAINNET_CONFIG,
  TESTNET: TESTNET_CONFIG,
};

export * from './wormhole.js';
export * from './types.js';
export * from './explorer.js';
export * from './utils/index.js';

export { RelayerAbstract } from './abstracts/relayer.js';
export { ContractsAbstract } from './abstracts/contracts.js';
export { TokenBridgeAbstract } from './abstracts/tokenBridge.js';
export { SolanaAbstract } from './abstracts/contexts/solana.js';
export { SeiAbstract } from './abstracts/contexts/sei.js';

export * from './abis/TokenBridgeRelayer.js';
export * from './abis/TokenBridgeRelayer__factory.js';
export const SolanaContracts = {
  Wormhole: SolanaWormhole,
  TokenBridge: SolanaTokenBridge,
  NftBridge: SolanaNftBridge,
};

export * from './anchor-idl/index.js';