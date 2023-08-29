import { Connection, PublicKey, PublicKeyInitData } from '@solana/web3.js';
import {
  ChainName,
  ChainId,
  toChainId,
  PlatformName,
  Network,
} from '@wormhole-foundation/sdk-base';
import {
  Platform,
  TokenId,
  TokenBridge,
  AutomaticTokenBridge,
  RpcConnection,
  CircleBridge,
  AutomaticCircleBridge,
  SignedTxn,
  TxHash,
  WormholeMessageId,
} from '@wormhole-foundation/sdk-definitions';

import { SolanaContracts } from './contracts';
import { getForeignAssetSolana } from './utils';
import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import { SolanaAddress } from './address';
import { SolanaChain } from './chain';
import { SolanaTokenBridge } from './protocols/tokenBridge';
import { ChainsConfig } from '@wormhole-foundation/connect-sdk';

const SOLANA_SEQ_LOG = 'Program log: Sequence: ';

// const sharedEmitter =
//   '3b26409f8aaded3f5ddca184695aa6a0fa829b0c85caf84856324896d214ca98';
// const SOLANA_EMMITER_ID = {
//   Mainnet: 'ec7372995d5cc8732397fb0ad35c0121e0eaa90d26f828a534cab54391b3a4f5',
//   Testnet: sharedEmitter,
//   Devnet: sharedEmitter,
// };

/**
 * @category Solana
 */
export class SolanaPlatform implements Platform {
  static readonly _platform: 'Solana' = 'Solana';
  readonly platform: PlatformName = SolanaPlatform._platform;

  readonly network: Network;
  readonly conf: ChainsConfig;
  readonly contracts: SolanaContracts;

  constructor(network: Network, conf: ChainsConfig) {
    this.network = network;
    this.conf = conf;
    this.contracts = new SolanaContracts(conf);
  }

  getRpc(chain: ChainName): Connection {
    const rpcAddress = this.conf[chain]!.rpc;
    return new Connection(rpcAddress);
  }

  getChain(chain: ChainName): SolanaChain {
    return new SolanaChain(this, chain);
  }

  async getTokenBridge(rpc: Connection): Promise<TokenBridge<'Solana'>> {
    return SolanaTokenBridge.fromProvider(rpc);
  }

  async getAutomaticTokenBridge(
    rpc: RpcConnection,
  ): Promise<AutomaticTokenBridge<'Solana'>> {
    throw new Error('Not implemented');
  }

  async getCircleBridge(rpc: RpcConnection): Promise<CircleBridge<'Solana'>> {
    throw new Error('Not implemented');
  }

  async getAutomaticCircleBridge(
    rpc: RpcConnection,
  ): Promise<AutomaticCircleBridge<'Solana'>> {
    throw new Error('Not implemented');
  }

  async getForeignAsset(
    chain: ChainName,
    rpc: Connection,
    tokenId: TokenId,
  ): Promise<UniversalAddress | null> {
    const chainId = toChainId(tokenId.chain);
    const destChainId = toChainId(chain);
    if (destChainId === chainId) return tokenId.address.toUniversalAddress();

    const contracts = this.contracts.mustGetContracts(chain);
    if (!contracts.tokenBridge) throw new Error('contracts not found');

    const addr = await getForeignAssetSolana(
      rpc,
      contracts.tokenBridge,
      chainId as any,
      tokenId.address.toUint8Array(),
    );

    if (!addr) return null;

    return new SolanaAddress(addr).toUniversalAddress();
  }

  async getTokenDecimals(
    rpc: Connection,
    tokenAddr: UniversalAddress,
  ): Promise<bigint> {
    let mint = await rpc.getParsedAccountInfo(new PublicKey(tokenAddr));
    if (!mint) throw new Error('could not fetch token details');
    const { decimals } = (mint as any).value.data.parsed.info;
    return decimals;
  }

  async getNativeBalance(rpc: Connection, walletAddr: string): Promise<bigint> {
    const balance = await rpc.getBalance(new PublicKey(walletAddr));
    return BigInt(balance);
  }

  async getTokenBalance(
    chain: ChainName,
    rpc: Connection,
    walletAddress: string,
    tokenId: TokenId,
  ): Promise<bigint | null> {
    const address = await this.getForeignAsset(chain, rpc, tokenId);
    if (!address) return null;

    const splToken = await rpc.getTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { mint: new PublicKey(address) },
    );
    if (!splToken.value[0]) return null;
    const balance = await rpc.getTokenAccountBalance(splToken.value[0].pubkey);

    return BigInt(balance.value.amount);
  }

  async sendWait(rpc: Connection, stxns: SignedTxn[]): Promise<TxHash[]> {
    throw new Error('Not implemented');
  }

  parseAddress(address: string): UniversalAddress {
    return new UniversalAddress(new PublicKey(address).toBytes());
  }

  async parseTransaction(
    chain: ChainName,
    rpc: Connection,
    tx: string,
  ): Promise<WormholeMessageId[]> {
    const contracts = this.contracts.mustGetContracts(chain);

    if (!contracts.coreBridge) throw new Error('contracts not found');

    const response = await rpc.getTransaction(tx);
    const parsedResponse = await rpc.getParsedTransaction(tx);

    if (!response || !response.meta?.innerInstructions![0].instructions)
      throw new Error('transaction not found');

    const instructions = response.meta?.innerInstructions![0].instructions;
    const accounts = response.transaction.message.accountKeys;

    // find the instruction where the programId equals the Wormhole ProgramId and the emitter equals the Token Bridge
    const bridgeInstructions = instructions.filter((i) => {
      const programId = accounts[i.programIdIndex].toString();
      const wormholeCore = contracts.coreBridge;
      return programId === wormholeCore;
    });

    console.log(bridgeInstructions);

    // get sequence
    const sequence = response.meta?.logMessages
      ?.filter((msg) => msg.startsWith(SOLANA_SEQ_LOG))?.[0]
      ?.replace(SOLANA_SEQ_LOG, '');

    if (!sequence) {
      throw new Error('sequence not found');
    }

    throw new Error('Not finished');

    // return [
    //   {
    //     chain,
    //     emitter: new UniversalAddress(new Uint8Array()),
    //     sequence: BigInt(sequence),
    //   },
    // ];
  }
}
