import { ChainName } from '@wormhole-foundation/sdk-base';
import {
  TokenId,
  TxHash,
  Platform,
  WormholeMessageId,
  isWormholeMessageId,
  SignedTxn,
  AutomaticTokenBridge,
  TokenBridge,
  UniversalAddress,
  CircleBridge,
  AutomaticCircleBridge,
  ChainsConfig,
  toNative,
} from '@wormhole-foundation/sdk-definitions';

import { ethers } from 'ethers';
import { EvmContracts } from './contracts';
import { EvmChain } from './chain';

import { EvmTokenBridge } from './protocols/tokenBridge';
import { EvmAutomaticTokenBridge } from './protocols/automaticTokenBridge';
import { EvmAutomaticCircleBridge } from './protocols/automaticCircleBridge';
import { EvmCircleBridge } from './protocols/circleBridge';

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

  getRpc(chain: ChainName): ethers.JsonRpcProvider {
    const rpcAddress = this.conf[chain]!.rpc;
    return new ethers.JsonRpcProvider(rpcAddress);
  }

  getChain(chain: ChainName): EvmChain {
    return new EvmChain(this, chain);
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

  async getWrappedAsset(
    chain: ChainName,
    rpc: ethers.Provider,
    token: TokenId,
  ): Promise<TokenId | null> {
    // if the token is already native, return the token address
    if (chain === token.chain) return token;

    const tokenBridge = await this.getTokenBridge(rpc);
    const foreignAddr = await tokenBridge.getWrappedAsset({
      chain,
      address: token.address,
    });
    return { chain, address: foreignAddr.toUniversalAddress() };
  }

  async getTokenDecimals(
    rpc: ethers.Provider,
    token: TokenId,
  ): Promise<bigint> {
    const tokenContract = this.contracts.mustGetTokenImplementation(
      rpc,
      token.address.toString(),
    );
    const decimals = await tokenContract.decimals();
    return decimals;
  }

  async getNativeBalance(
    rpc: ethers.Provider,
    walletAddr: string,
  ): Promise<bigint> {
    return await rpc.getBalance(walletAddr);
  }

  async getTokenBalance(
    chain: ChainName,
    rpc: ethers.Provider,
    walletAddr: string,
    tokenId: TokenId,
  ): Promise<bigint | null> {
    const address = await this.getWrappedAsset(chain, rpc, tokenId);
    if (!address) return null;

    const token = this.contracts.mustGetTokenImplementation(
      rpc,
      address.toString(),
    );
    const balance = await token.balanceOf(walletAddr);
    return balance;
  }

  async sendWait(rpc: ethers.Provider, stxns: SignedTxn[]): Promise<TxHash[]> {
    const txhashes: TxHash[] = [];
    // TODO: concurrent?
    for (const stxn of stxns) {
      const txRes = await rpc.broadcastTransaction(stxn);
      const txReceipt = await txRes.wait();
      // TODO: throw error?
      if (txReceipt === null) continue;

      txhashes.push(txReceipt.hash);
    }
    return txhashes;
  }

  parseAddress(chain: ChainName, address: string): UniversalAddress {
    return toNative(chain, address).toUniversalAddress();
  }

  async parseTransaction(
    chain: ChainName,
    rpc: ethers.Provider,
    txid: TxHash,
  ): Promise<WormholeMessageId[]> {
    const receipt = await rpc.getTransactionReceipt(txid);

    if (receipt === null)
      throw new Error(`No transaction found with txid: ${txid}`);

    const core = this.contracts.mustGetCore(chain, rpc);
    const coreAddress = await core.getAddress();
    const coreImpl = this.contracts.getImplementation();

    return receipt.logs
      .filter((l: any) => {
        return l.address === coreAddress;
      })
      .map((log) => {
        const { topics, data } = log;
        const parsed = coreImpl.parseLog({ topics: topics.slice(), data });
        if (parsed === null) return undefined;
        return {
          chain: chain,
          emitter: this.parseAddress(chain, parsed.args.sender),
          sequence: parsed.args.sequence,
        } as WormholeMessageId;
      })
      .filter(isWormholeMessageId);
  }
}
