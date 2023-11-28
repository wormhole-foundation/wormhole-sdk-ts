import { Connection } from '@solana/web3.js';
import {
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  CircleBridge,
  CircleTransferMessage,
  Contracts,
  Network,
  Platform,
} from '@wormhole-foundation/connect-sdk';

import {
  SolanaChains,
  SolanaPlatform,
  SolanaPlatformType,
  SolanaUnsignedTransaction,
} from '@wormhole-foundation/connect-sdk-solana';

export class SolanaCircleBridge<N extends Network, C extends SolanaChains>
  implements CircleBridge<N, SolanaPlatformType, C>
{
  private constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: Connection,
    readonly contracts: Contracts,
  ) {
    if (network === 'Devnet')
      throw new Error('CircleBridge not supported on Devnet');

    const msgTransmitterAddress = contracts.cctp?.messageTransmitter;
    if (!msgTransmitterAddress)
      throw new Error(
        `Circle Messenge Transmitter contract for domain ${chain} not found`,
      );

    const tokenMessengerAddress = contracts.cctp?.tokenMessenger;
    if (!tokenMessengerAddress)
      throw new Error(
        `Circle Token Messenger contract for domain ${chain} not found`,
      );
  }

  static async fromRpc<N extends Network>(
    provider: Connection,
    config: ChainsConfig<N, Platform>,
  ): Promise<SolanaCircleBridge<N, SolanaChains>> {
    const [network, chain] = await SolanaPlatform.chainFromRpc(provider);
    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);
    return new SolanaCircleBridge(
      network as N,
      chain,
      provider,
      conf.contracts,
    );
  }

  async *redeem(
    sender: AccountAddress<C>,
    message: string,
    attestation: string,
  ): AsyncGenerator<SolanaUnsignedTransaction<N, C>> {
    throw new Error('no');
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<SolanaUnsignedTransaction<N, C>> {
    throw new Error('no');
  }

  // Fetch the transaction logs and parse the CircleTransferMessage
  async parseTransactionDetails(txid: string): Promise<CircleTransferMessage> {
    throw new Error('No');
  }

  //private createUnsignedTx(
  //  txReq: TransactionRequest,
  //  description: string,
  //  parallelizable: boolean = false,
  //): SolanaUnsignedTransaction<N, C> {
  //  return new SolanaUnsignedTransaction(
  //    addChainId(txReq, this.chainId),
  //    this.network,
  //    this.chain,
  //    description,
  //    parallelizable,
  //  );
  //}
}
