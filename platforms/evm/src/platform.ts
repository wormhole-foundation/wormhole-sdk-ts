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
} from '@wormhole-foundation/connect-sdk';

import { ethers } from 'ethers';
import { EvmContracts } from './contracts';
import { EvmChain } from './chain';

import { EvmTokenBridge } from './protocols/tokenBridge';
import { EvmAutomaticTokenBridge } from './protocols/automaticTokenBridge';
import { EvmAutomaticCircleBridge } from './protocols/automaticCircleBridge';
import { EvmCircleBridge } from './protocols/circleBridge';
import { EvmWormholeCore } from './protocols/wormholeCore';

/**
 * @category EVM
 */
export class EvmPlatform implements Platform<'Evm'> {
  // Provides runtime concrete value
  static _platform: 'Evm' = 'Evm';
  readonly platform = EvmPlatform._platform;

  readonly conf: ChainsConfig;
  readonly contracts: EvmContracts;

  constructor(conf: ChainsConfig) {
    this.conf = conf;
    this.contracts = new EvmContracts(conf);
  }

  getRpc(chain: ChainName): ethers.Provider {
    const rpcAddress = this.conf[chain]!.rpc;
    return ethers.getDefaultProvider(rpcAddress);
  }

  getChain(chain: ChainName): EvmChain {
    return new EvmChain(this, chain);
  }

  getWormholeCore(rpc: ethers.Provider): Promise<WormholeCore<'Evm'>> {
    return EvmWormholeCore.fromProvider(rpc, this.contracts);
  }

  async getTokenBridge(rpc: ethers.Provider): Promise<TokenBridge<'Evm'>> {
    return await EvmTokenBridge.fromProvider(rpc, this.contracts);
  }
  async getAutomaticTokenBridge(
    rpc: ethers.Provider,
  ): Promise<AutomaticTokenBridge<'Evm'>> {
    return await EvmAutomaticTokenBridge.fromProvider(rpc, this.contracts);
  }

  async getCircleBridge(rpc: ethers.Provider): Promise<CircleBridge<'Evm'>> {
    return await EvmCircleBridge.fromProvider(rpc, this.contracts);
  }
  async getAutomaticCircleBridge(
    rpc: ethers.Provider,
  ): Promise<AutomaticCircleBridge<'Evm'>> {
    return await EvmAutomaticCircleBridge.fromProvider(rpc, this.contracts);
  }

  async getDecimals(
    chain: ChainName,
    rpc: ethers.Provider,
    token: TokenId | 'native',
  ): Promise<bigint> {
    if (token === 'native')
      return BigInt(this.conf[chain]!.nativeTokenDecimals);

    const tokenContract = this.contracts.mustGetTokenImplementation(
      rpc,
      token.address.toString(),
    );
    const decimals = await tokenContract.decimals();
    return decimals;
  }

  async getBalance(
    chain: ChainName,
    rpc: ethers.Provider,
    walletAddr: string,
    tokenId: TokenId | 'native',
  ): Promise<bigint | null> {
    if (tokenId === 'native') return await rpc.getBalance(walletAddr);

    const tb = await this.getTokenBridge(rpc);

    const address = await tb.getWrappedAsset(tokenId);
    if (!address) return null;

    const token = this.contracts.mustGetTokenImplementation(
      rpc,
      address.toString(),
    );
    const balance = await token.balanceOf(walletAddr);
    return balance;
  }

  async sendWait(rpc: ethers.Provider, stxns: SignedTx[]): Promise<TxHash[]> {
    const txhashes: TxHash[] = [];
    for (const stxn of stxns) {
      const txRes = await rpc.broadcastTransaction(stxn);
      const txReceipt = await txRes.wait();
      // TODO: throw error?
      if (txReceipt === null) continue;

      txhashes.push(txReceipt.hash);
    }
    return txhashes;
  }

  parseAddress(chain: ChainName, address: string): NativeAddress<'Evm'> {
    return toNative(chain, address) as NativeAddress<'Evm'>;
  }

  async parseTransaction(
    chain: ChainName,
    rpc: ethers.Provider,
    txid: TxHash,
  ): Promise<WormholeMessageId[]> {
    const receipt = await rpc.getTransactionReceipt(txid);

    if (receipt === null)
      throw new Error(`No transaction found with txid: ${txid}`);

    const coreAddress = this.conf[chain]!.contracts.coreBridge;
    const coreImpl = this.contracts.getCoreImplementationInterface();

    return receipt.logs
      .filter((l: any) => {
        return l.address === coreAddress;
      })
      .map((log) => {
        const { topics, data } = log;
        const parsed = coreImpl.parseLog({ topics: topics.slice(), data });
        if (parsed === null) return undefined;

        const emitterAddress = this.parseAddress(chain, parsed.args.sender);
        return {
          chain: chain,
          emitter: emitterAddress.toUniversalAddress(),
          sequence: parsed.args.sequence,
        } as WormholeMessageId;
      })
      .filter(isWormholeMessageId);
  }
}
