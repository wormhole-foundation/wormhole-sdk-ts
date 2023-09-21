import {
  ChainName,
  TokenId,
  TxHash,
  Platform,
  WormholeMessageId,
  isWormholeMessageId,
  SignedTx,
  AutomaticTokenBridge,
  TokenBridge,
  CircleBridge,
  AutomaticCircleBridge,
  ChainsConfig,
  toNative,
  NativeAddress,
  WormholeCore,
  CONFIG,
  networkPlatformConfigs,
} from '@wormhole-foundation/connect-sdk';

import { ethers } from 'ethers';
import { EvmContracts } from './contracts';
import { EvmChain } from './chain';

import { EvmTokenBridge } from './protocols/tokenBridge';
import { EvmAutomaticTokenBridge } from './protocols/automaticTokenBridge';
import { EvmAutomaticCircleBridge } from './protocols/automaticCircleBridge';
import { EvmCircleBridge } from './protocols/circleBridge';
import { EvmWormholeCore } from './protocols/wormholeCore';

const _: Platform<'Evm'> = EvmPlatform;

/**
 * @category EVM
 */
// Provides runtime concrete value
export module EvmPlatform {
  export const platform: 'Evm' = 'Evm';
  export let conf: ChainsConfig = networkPlatformConfigs('Testnet', platform);
  let contracts: EvmContracts = new EvmContracts(conf);

  export function setConfig(_conf: ChainsConfig): Platform<'Evm'> {
    conf = _conf;
    contracts = new EvmContracts(conf);
    return EvmPlatform;
  }

  export function getRpc(chain: ChainName): ethers.Provider {
    const rpcAddress = conf[chain]!.rpc;
    return ethers.getDefaultProvider(rpcAddress);
  }

  export function getChain(chain: ChainName): EvmChain {
    return new EvmChain(EvmPlatform, chain);
  }

  export function getWormholeCore(
    rpc: ethers.Provider,
  ): Promise<WormholeCore<'Evm'>> {
    return EvmWormholeCore.fromProvider(rpc, contracts);
  }

  export async function getTokenBridge(
    rpc: ethers.Provider,
  ): Promise<TokenBridge<'Evm'>> {
    return await EvmTokenBridge.fromProvider(rpc, contracts);
  }
  export async function getAutomaticTokenBridge(
    rpc: ethers.Provider,
  ): Promise<AutomaticTokenBridge<'Evm'>> {
    return await EvmAutomaticTokenBridge.fromProvider(rpc, contracts);
  }

  export async function getCircleBridge(
    rpc: ethers.Provider,
  ): Promise<CircleBridge<'Evm'>> {
    return await EvmCircleBridge.fromProvider(rpc, contracts);
  }

  export async function getAutomaticCircleBridge(
    rpc: ethers.Provider,
  ): Promise<AutomaticCircleBridge<'Evm'>> {
    return await EvmAutomaticCircleBridge.fromProvider(rpc, contracts);
  }

  export async function getDecimals(
    chain: ChainName,
    rpc: ethers.Provider,
    token: TokenId | 'native',
  ): Promise<bigint> {
    if (token === 'native') return BigInt(conf[chain]!.nativeTokenDecimals);

    const tokenContract = contracts.mustGetTokenImplementation(
      rpc,
      token.address.toString(),
    );
    const decimals = await tokenContract.decimals();
    return decimals;
  }

  export async function getBalance(
    chain: ChainName,
    rpc: ethers.Provider,
    walletAddr: string,
    tokenId: TokenId | 'native',
  ): Promise<bigint | null> {
    if (tokenId === 'native') return await rpc.getBalance(walletAddr);

    const tb = await getTokenBridge(rpc);

    const address = await tb.getWrappedAsset(tokenId);
    if (!address) return null;

    const token = contracts.mustGetTokenImplementation(rpc, address.toString());
    const balance = await token.balanceOf(walletAddr);
    return balance;
  }

  export async function sendWait(
    chain: ChainName,
    rpc: ethers.Provider,
    stxns: SignedTx[],
  ): Promise<TxHash[]> {
    const txhashes: TxHash[] = [];
    for (const stxn of stxns) {
      const txRes = await rpc.broadcastTransaction(stxn);
      txhashes.push(txRes.hash);

      if (chain === 'Celo') {
        console.error('TODO: override celo block fetching');
        continue;
      }

      // Wait for confirmation
      const txReceipt = await txRes.wait();
      if (txReceipt === null) continue; // TODO: throw error?
    }
    return txhashes;
  }

  export function parseAddress(
    chain: ChainName,
    address: string,
  ): NativeAddress<'Evm'> {
    return toNative(chain, address) as NativeAddress<'Evm'>;
  }

  export async function parseTransaction(
    chain: ChainName,
    rpc: ethers.Provider,
    txid: TxHash,
  ): Promise<WormholeMessageId[]> {
    const receipt = await rpc.getTransactionReceipt(txid);

    if (receipt === null)
      throw new Error(`No transaction found with txid: ${txid}`);

    const coreAddress = conf[chain]!.contracts.coreBridge;
    const coreImpl = contracts.getCoreImplementationInterface();

    return receipt.logs
      .filter((l: any) => {
        return l.address === coreAddress;
      })
      .map((log) => {
        const { topics, data } = log;
        const parsed = coreImpl.parseLog({ topics: topics.slice(), data });
        if (parsed === null) return undefined;

        const emitterAddress = parseAddress(chain, parsed.args.sender);
        return {
          chain: chain,
          emitter: emitterAddress.toUniversalAddress(),
          sequence: parsed.args.sequence,
        } as WormholeMessageId;
      })
      .filter(isWormholeMessageId);
  }
}
