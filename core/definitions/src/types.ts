import {
  Chain,
  ChainToPlatform,
  Network,
  Platform,
  PlatformToChains,
  finality,
  chainToPlatform,
  chains,
  isChain,
  toChainId,
  decimals,
  explorer,
  rpc,
  nativeChainIds,
} from "@wormhole-foundation/sdk-base";
import { ChainAddress, NativeAddress, toNative } from "./address";
import { Contracts, getContracts } from "./contracts";
import { Signer, isSigner } from "./signer";

import { UniversalAddress } from "./universalAddress";

export type TxHash = string;
export type SequenceId = bigint;
export type SignedTx = any;

export type TokenId<C extends Chain = Chain> = ChainAddress<C>;
export function isTokenId(thing: any): thing is TokenId<Chain> {
  return (
    typeof (<TokenId<Chain>>thing).address !== undefined && isChain((<TokenId<Chain>>thing).chain)
  );
}

export type Balances = {
  [key: string]: bigint | null;
};

export function nativeChainAddress<C extends Chain>(
  chain: C,
  address: UniversalAddress | Uint8Array | string,
): ChainAddress<C>;

export function nativeChainAddress<C extends Chain>(
  s: Signer<Network, C> | TokenId<C> | [C, UniversalAddress | Uint8Array | string],
): ChainAddress<C> {
  let chain: C;
  let address: NativeAddress<C>;

  if (Array.isArray(s)) {
    // We might be passed a universal address as a string
    // First try to decode it as native, otherwise try
    // to decode it as universal and convert it to native
    try {
      address = toNative(s[0], s[1]);
    } catch {
      address = UniversalAddress.instanceof(s[1])
        ? s[1].toNative(s[0])
        : new UniversalAddress(s[1]).toNative(s[0]);
    }
    chain = s[0];
    address = address;
  } else if (isSigner(s)) {
    chain = s.chain();
    address = toNative(s.chain(), s.address());
  } else {
    // otherwise TokenId
    chain = s.chain;
    address = s.address.toNative(s.chain) as NativeAddress<C>;
  }
  return { chain, address };
}

// Fully qualifier Transaction ID
export type TransactionId = { chain: Chain; txid: TxHash };
export function isTransactionIdentifier(thing: TransactionId | any): thing is TransactionId {
  return (<TransactionId>thing).chain !== undefined && (<TransactionId>thing).txid !== undefined;
}

// Configuration for a given Chain
export type ChainConfig<N extends Network, C extends Chain> = {
  key: C;
  network: N;
  platform: ChainToPlatform<C>;
  // Wormhole Chain Id for this chain
  chainId: number;
  // Contract addresses for this chain
  contracts: Contracts;
  // Number of blocks before a transaction is considered final
  finalityThreshold: number;
  // Average block time in milliseconds
  blockTime: number;
  // Number of decimal places for the native gas token (e.g. 18 for ETH)
  nativeTokenDecimals: number;
  // Native chain id may be eip155 or genesis hash or network moninker or something else
  // depending on the platform
  nativeChainId: string | bigint;
  rpc: string;
  explorer?: explorer.ExplorerSettings;
};

export type ChainsConfig<N extends Network, P extends Platform> = {
  [K in PlatformToChains<P>]?: ChainConfig<N, K>;
};

export function buildConfig<N extends Network>(n: N): ChainsConfig<N, Platform> {
  const cc: ChainsConfig<N, Platform> = chains
    .map(<C extends Chain>(c: C): ChainConfig<N, C> => {
      const platform = chainToPlatform(c);
      let nativeChainId: bigint | string = "";
      try {
        nativeChainId = nativeChainIds.networkChainToNativeChainId.get(n, c);
      } catch {}
      return {
        key: c,
        platform,
        network: n,
        chainId: toChainId(c),
        finalityThreshold: finality.finalityThreshold.get(c) ?? 0,
        blockTime: finality.blockTime(c),
        contracts: getContracts(n, c),
        nativeTokenDecimals: decimals.nativeDecimals(platform),
        nativeChainId,
        explorer: explorer.explorerConfigs(n, c),
        rpc: rpc.rpcAddress(n, c),
      };
    })
    .reduce((acc, curr) => {
      return { ...acc, [curr.key]: curr };
    }, {});

  return cc;
}
