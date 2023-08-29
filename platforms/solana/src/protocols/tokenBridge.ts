import { Network } from '@wormhole-foundation/sdk-base';
import {
  UniversalOrNative,
  TokenBridge,
  ChainAddress,
  VAA,
} from '@wormhole-foundation/sdk-definitions';
import { TokenBridge as TokenBridgeContract } from '@certusone/wormhole-sdk/lib/cjs/solana/types/tokenBridge';
import { SolanaContracts } from '../contracts';
import { Connection, Transaction } from '@solana/web3.js';
import { Program } from '@project-serum/anchor';
import { SolanaUnsignedTransaction } from '../unsignedTransaction';
import { SolanaAddress } from '../address';
import { SolanaChainName, UniversalOrSolana } from '../types';

export class SolanaTokenBridge implements TokenBridge<'Solana'> {
  readonly tokenBridge: Program<TokenBridgeContract>;

  private constructor(
    readonly network: Network,
    readonly chain: SolanaChainName,
    readonly connection: Connection,
    readonly contracts: SolanaContracts,
  ) {
    this.tokenBridge = this.contracts.mustGetBridge(chain, connection);
  }

  static async fromProvider(provider: Connection): Promise<SolanaTokenBridge> {
    throw new Error('not implemented');
  }

  async isWrappedAsset(token: UniversalOrNative<'Solana'>): Promise<boolean> {
    throw new Error('not implemented');
  }

  async getOriginalAsset(token: UniversalOrSolana): Promise<ChainAddress> {
    throw new Error('not implemented');
  }

  async hasWrappedAsset(tokenId: ChainAddress): Promise<boolean> {
    throw new Error('not implemented');
  }

  async getWrappedAsset(tokenId: ChainAddress): Promise<SolanaAddress> {
    throw new Error('not implemented');
  }

  async isTransferCompleted(
    vaa: VAA<'Transfer'> | VAA<'TransferWithPayload'>,
  ): Promise<boolean> {
    throw new Error('not implemented');
  }

  // //TODO bestEffortFindRedemptionTx()

  async *createAttestation(
    token: UniversalOrSolana,
  ): AsyncGenerator<SolanaUnsignedTransaction> {
    throw new Error('not implemented');
  }

  async *submitAttestation(
    vaa: VAA<'AttestMeta'>,
  ): AsyncGenerator<SolanaUnsignedTransaction> {
    throw new Error('not implemented');
  }

  //alternative naming: initiateTransfer
  async *transfer(
    sender: UniversalOrSolana,
    recipient: ChainAddress,
    token: UniversalOrSolana | 'native',
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<SolanaUnsignedTransaction> {
    throw new Error('not implemented');
  }

  //alternative naming: completeTransfer
  async *redeem(
    sender: UniversalOrSolana,
    vaa: VAA<'Transfer'> | VAA<'TransferWithPayload'>,
    unwrapNative: boolean = true,
  ): AsyncGenerator<SolanaUnsignedTransaction> {
    throw new Error('not implemented');
  }

  private createUnsignedTx(
    txReq: Transaction,
    description: string,
    stackable: boolean = false,
  ): SolanaUnsignedTransaction {
    // throw new Error('not implemented')
    return new SolanaUnsignedTransaction(
      txReq,
      this.network,
      'Solana',
      description,
      stackable,
    );
  }
}
