import {
  AutomaticCircleBridge,
  AutomaticTokenBridge,
  Balances,
  Chain,
  ChainsConfig,
  CircleBridge,
  Network,
  PlatformContext,
  ProtocolImplementation,
  ProtocolInitializer,
  ProtocolName,
  RpcConnection,
  SignedTx,
  TokenBridge,
  TokenId,
  TxHash,
  WormholeCore,
  WormholeMessageId,
  chainToPlatform,
  getProtocolInitializer,
  nativeChainAddress,
  nativeDecimals,
  networkPlatformConfigs
} from '@wormhole-foundation/connect-sdk';

import { encoding, protocolNativeChainIdToNetworkChain } from '@wormhole-foundation/sdk-base';
import { Provider, ethers } from 'ethers';
import { EvmAddress, EvmZeroAddress } from './address';
import { EvmChain } from './chain';
import * as ethers_contracts from './ethers-contracts';
import { AnyEvmAddress, EvmChains } from './types';

/**
 * @category EVM
 */


export class EvmPlatform<N extends Network, P extends 'Evm' = 'Evm'> implements PlatformContext<N, P> {
  static _platform: 'Evm' = 'Evm';
  config: ChainsConfig<N, P>

  static Platform(): typeof EvmPlatform._platform {
    return EvmPlatform._platform;
  }


  constructor(
    readonly network: N,
    readonly platform: P,
    readonly _config?: ChainsConfig<N, P>,
  ) {
    this.config = _config ?? networkPlatformConfigs(network, EvmPlatform._platform);
  }

  getRpc<C extends EvmChains>(chain: C): ethers.Provider {
    if (chain in this.config) return ethers.getDefaultProvider(this.config[chain].rpc);
    throw new Error('No configuration available for chain: ' + chain);
  }

  getChain<C extends EvmChains>(chain: C): EvmChain<N, C, P> {
    if (chain in this.config) return new EvmChain<N, C, P>(this.config[chain]);
    throw new Error('No configuration available for chain: ' + chain);
  }


  getProtocol<PN extends ProtocolName,>(protocol: PN, rpc: RpcConnection<P>): ProtocolImplementation<P, PN> {
    return EvmPlatform.getProtocolInitializer(protocol).fromRpc(rpc, this.config);
  }

  async getWormholeCore(
    rpc: ethers.Provider,
  ): Promise<WormholeCore<P>> {
    return this.getProtocol('WormholeCore', rpc);
  }
  async getTokenBridge(
    rpc: ethers.Provider,
  ): Promise<TokenBridge<P>> {
    return this.getProtocol('TokenBridge', rpc);
  }
  async getAutomaticTokenBridge(
    rpc: ethers.Provider,
  ): Promise<AutomaticTokenBridge<P>> {
    return this.getProtocol('TokenBridge', rpc);
  }
  async getCircleBridge(
    rpc: ethers.Provider,
  ): Promise<CircleBridge<P>> {
    return this.getProtocol('CircleBridge', rpc);
  }
  async getAutomaticCircleBridge(
    rpc: ethers.Provider,
  ): Promise<AutomaticCircleBridge<P>> {
    return this.getProtocol('AutomaticCircleBridge', rpc);
  }

  async parseTransaction(
    chain: Chain,
    rpc: ethers.Provider,
    txid: TxHash,
  ): Promise<WormholeMessageId[]> {
    const wc = await this.getWormholeCore(rpc);
    return wc.parseTransaction(txid);
  }


  static nativeTokenId(chain: Chain): TokenId {
    if (!EvmPlatform.isSupportedChain(chain))
      throw new Error(`invalid chain for EVM: ${chain}`);
    return nativeChainAddress(chain, EvmZeroAddress);
  }

  static isSupportedChain(chain: Chain): boolean {
    const platform = chainToPlatform(chain);
    return platform === EvmPlatform._platform;
  }

  static isNativeTokenId(chain: Chain, tokenId: TokenId): boolean {
    if (!EvmPlatform.isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    return tokenId.address.toString() === EvmZeroAddress;
  }

  static async getDecimals(
    chain: Chain,
    rpc: Provider,
    token: AnyEvmAddress | 'native',
  ): Promise<bigint> {
    if (token === 'native') return BigInt(nativeDecimals(EvmPlatform._platform));

    const tokenContract = EvmPlatform.getTokenImplementation(
      rpc,
      new EvmAddress(token).toString(),
    );
    return tokenContract.decimals();
  }

  static async getBalance(
    chain: Chain,
    rpc: Provider,
    walletAddr: string,
    token: AnyEvmAddress | 'native',
  ): Promise<bigint | null> {
    if (token === 'native') return rpc.getBalance(walletAddr);

    const tokenImpl = EvmPlatform.getTokenImplementation(
      rpc,
      new EvmAddress(token).toString(),
    );
    return tokenImpl.balanceOf(walletAddr);
  }

  static async getBalances(
    chain: Chain,
    rpc: Provider,
    walletAddr: string,
    tokens: (AnyEvmAddress | 'native')[],
  ): Promise<Balances> {
    const balancesArr = await Promise.all(
      tokens.map(async (token) => {
        const balance = await this.getBalance(chain, rpc, walletAddr, token);
        const address =
          token === 'native' ? 'native' : new EvmAddress(token).toString();
        return { [address]: balance };
      }),
    );
    return balancesArr.reduce((obj, item) => Object.assign(obj, item), {});
  }

  static async sendWait(
    chain: Chain,
    rpc: Provider,
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
      if (txReceipt === null) throw new Error('Received null TxReceipt');
    }
    return txhashes;
  }

  static async getCurrentBlock(rpc: Provider): Promise<number> {
    return await rpc.getBlockNumber();
  }

  // Look up the Wormhole Canonical Network and Chain from the EVM chainId
  static chainFromChainId(
    eip155ChainId: string,
  ): [Network, EvmChains] {
    const networkChainPair = protocolNativeChainIdToNetworkChain(
      EvmPlatform._platform,
      // @ts-ignore
      BigInt(eip155ChainId),
    );

    if (networkChainPair === undefined)
      throw new Error(`Unknown EVM chainId ${eip155ChainId}`);

    const [network, chain] = networkChainPair;
    return [network, chain];
  }

  static async chainFromRpc(
    rpc: Provider,
  ): Promise<[Network, EvmChains]> {
    const { chainId } = await rpc.getNetwork();
    return EvmPlatform.chainFromChainId(encoding.bignum.encode(chainId, true));
  }

  static getTokenImplementation(
    connection: Provider,
    address: string,
  ): ethers_contracts.TokenImplementation {
    const ti = ethers_contracts.TokenImplementation__factory.connect(
      address,
      connection,
    );
    if (!ti)
      throw new Error(`No token implementation available for: ${address}`);
    return ti;
  }

  static getProtocolInitializer<PN extends ProtocolName>(
    protocol: PN,
  ): ProtocolInitializer<typeof EvmPlatform._platform, PN> {
    return getProtocolInitializer(this._platform, protocol);
  }
}
