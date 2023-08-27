import {
  Network,
  ChainName,
  PlatformName,
} from '@wormhole-foundation/sdk-base';
import {
  RpcConnection,
  TokenId,
  TxHash,
  Platform,
  WormholeMessageId,
  isWormholeMessageId,
  SignedTxn,
  AutomaticTokenBridge,
  WormholeCircleRelayer,
  TokenBridge,
  UniversalAddress,
  CircleBridge,
} from '@wormhole-foundation/sdk-definitions';
import { ChainsConfig } from '@wormhole-foundation/connect-sdk';

import { ethers } from 'ethers';
import { EvmContracts } from './contracts';
import { EvmChain } from './chain';
import { EvmAddress } from './address';

import { EvmTokenBridge } from './protocols/tokenBridge';
import { EvmAutomaticTokenBridge } from './protocols/automaticTokenBridge';
import { EvmCircleRelayer } from './protocols/circleRelayer';
import { EvmCircleBridge } from './protocols/circleBridge';

/**
 * @category EVM
 */
export class EvmPlatform implements Platform {
  // TODO: this is bad, I wanted `platform` in the interface but couldnt make it
  // static, so we do a lil hackery
  static readonly _platform: 'Evm' = 'Evm';
  readonly platform: PlatformName = EvmPlatform._platform;

  readonly network: Network;
  readonly conf: ChainsConfig;
  readonly contracts: EvmContracts;

  constructor(network: Network, conf: ChainsConfig) {
    this.network = network;
    this.conf = conf;
    this.contracts = new EvmContracts(network);
  }

  getRpc(chain: ChainName): ethers.Provider {
    const rpcAddress = this.conf[chain]!.rpc;
    return new ethers.JsonRpcProvider(rpcAddress);
  }

  getChain(chain: ChainName): EvmChain {
    return new EvmChain(this, chain);
  }

  async getTokenBridge(rpc: ethers.Provider): Promise<TokenBridge<'Evm'>> {
    // TODO:
    // @ts-ignore
    return await EvmTokenBridge.fromProvider(rpc);
  }
  async getAutomaticTokenBridge(
    rpc: ethers.Provider,
  ): Promise<AutomaticTokenBridge<'Evm'>> {
    return await EvmAutomaticTokenBridge.fromProvider(rpc);
  }
  async getCircleRelayer(
    rpc: ethers.Provider,
  ): Promise<WormholeCircleRelayer<'Evm'>> {
    return await EvmCircleRelayer.fromProvider(rpc);
  }

  async getCircleBridge(rpc: ethers.Provider): Promise<CircleBridge<'Evm'>> {
    return await EvmCircleBridge.fromProvider(rpc);
  }

  async getForeignAsset(
    chain: ChainName,
    rpc: ethers.Provider,
    tokenId: TokenId,
  ): Promise<UniversalAddress | null> {
    // if the token is already native, return the token address
    if (chain === tokenId.chain) return tokenId.address.toUniversalAddress();

    const tokenBridge = await this.getTokenBridge(rpc);
    const foreignAddr = await tokenBridge.getWrappedAsset({
      chain,
      address: tokenId.address,
    });
    return foreignAddr.toUniversalAddress();
  }

  async getTokenDecimals(
    rpc: ethers.Provider,
    tokenAddr: UniversalAddress,
  ): Promise<bigint> {
    const tokenContract = this.contracts.mustGetTokenImplementation(
      rpc,
      tokenAddr.toString(),
    );
    const decimals = await tokenContract.decimals();
    return decimals;
  }

  async getNativeBalance(
    rpc: RpcConnection,
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
    const address = await this.getForeignAsset(chain, rpc, tokenId);
    if (!address) return null;

    const token = this.contracts.mustGetTokenImplementation(
      rpc,
      address.toString(),
    );
    const balance = await token.balanceOf(walletAddr);
    return balance;
  }

  async sendWait(rpc: RpcConnection, stxns: SignedTxn[]): Promise<TxHash[]> {
    const txhashes: TxHash[] = [];
    // TODO: concurrent?
    for (const stxn of stxns) {
      const txRes = await rpc.broadcastTransaction(stxn);
      const txReceipt = await txRes.wait();
      console.log(txReceipt);
      // TODO: throw error?
      if (txReceipt === null) continue;

      txhashes.push(txReceipt.hash);
    }
    return txhashes;
  }

  //

  parseAddress(address: string): UniversalAddress {
    // 42 is 20 bytes as hex + 2 bytes for 0x
    if (address.length > 42) {
      return new UniversalAddress(address);
    }
    return new EvmAddress(address).toUniversalAddress();
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
          emitter: this.parseAddress(parsed.args.sender),
          sequence: parsed.args.sequence,
        } as WormholeMessageId;
      })
      .filter(isWormholeMessageId);
  }
}
