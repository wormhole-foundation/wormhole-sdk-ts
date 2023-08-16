import {
  Network,
  ChainName,
  PlatformName,
} from '@wormhole-foundation/sdk-base';
import { TokenId } from '@wormhole-foundation/connect-sdk';
import { EvmContracts } from './contracts';
import { EvmTokenBridge } from './tokenBridge';
import { ethers } from 'ethers';
import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import { Platform, ChainsConfig } from '@wormhole-foundation/connect-sdk';
import { EvmChain } from './chain';
import { EvmAddress } from './address';

/**
 * @category EVM
 */
export class EvmPlatform implements Platform {
  // lol
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

  getProvider(chain: ChainName): ethers.Provider {
    const rpcAddress = this.conf[chain]!.rpc;
    return new ethers.JsonRpcProvider(rpcAddress);
  }

  getChain(chain: ChainName): EvmChain {
    return new EvmChain(this, chain);
  }

  async getTokenBridge(provider: ethers.Provider): Promise<EvmTokenBridge> {
    return await EvmTokenBridge.fromProvider(provider);
  }

  async getForeignAsset(
    tokenId: TokenId,
    chain: ChainName,
  ): Promise<UniversalAddress | null> {
    // if the token is already native, return the token address
    if (chain === tokenId[0]) return tokenId[1];

    // else fetch the representation
    // TODO: this uses a brand new provider, not great
    const tokenBridge = await this.getTokenBridge(this.getProvider(chain));
    const foreignAddr = await tokenBridge.getWrappedAsset([chain, tokenId[1]]);
    return foreignAddr.toUniversalAddress();
  }

  async getTokenDecimals(
    tokenAddr: UniversalAddress,
    chain: ChainName,
  ): Promise<bigint> {
    const provider = this.getProvider(chain);
    const tokenContract = this.contracts.mustGetTokenImplementation(
      provider,
      tokenAddr.toString(),
    );
    const decimals = await tokenContract.decimals();
    return decimals;
  }

  async getNativeBalance(
    walletAddr: string,
    chain: ChainName,
  ): Promise<bigint> {
    const provider = this.getProvider(chain);
    return await provider.getBalance(walletAddr);
  }

  async getTokenBalance(
    walletAddr: string,
    tokenId: TokenId,
    chain: ChainName,
  ): Promise<bigint | null> {
    const address = await this.getForeignAsset(tokenId, chain);
    if (!address) return null;

    const provider = this.getProvider(chain);
    const token = this.contracts.mustGetTokenImplementation(
      provider,
      address.toString(),
    );
    const balance = await token.balanceOf(walletAddr);
    return balance;
  }

  parseAddress(address: string): UniversalAddress {
    return new EvmAddress(address).toUniversalAddress();
  }
}
