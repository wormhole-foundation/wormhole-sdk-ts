import {
  contracts,
  toChainId,
  type AccountAddress,
  type ChainAddress,
  type ChainsConfig,
  type Contracts,
  type Network,
  type Platform,
  type TBTCBridge,
} from '@wormhole-foundation/sdk-connect';
import {
  SolanaAddress,
  SolanaPlatform,
  SolanaTransaction,
  SolanaUnsignedTransaction,
  type SolanaChains,
} from '@wormhole-foundation/sdk-solana';
import {
  utils as coreUtils,
  SolanaWormholeCore,
} from '@wormhole-foundation/sdk-solana-core';
import {
  deriveAuthoritySignerKey,
  deriveEndpointKey,
  deriveMintAuthorityKey,
  deriveSenderAccountKey,
  deriveTokenBridgeConfigKey,
  deriveWrappedMetaKey,
} from '@wormhole-foundation/sdk-solana-tokenbridge';
import {
  Connection,
  MessageV0,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import { BN, Program } from '@coral-xyz/anchor';
import { WormholeGateway, WormholeGatewayIdl } from './anchor-idl/gateway.js';
import {
  getConfigPda,
  getCoreMessagePda,
  getCustodianPda,
  getGatewayInfoPda,
  getMinterInfoPda,
  TBTC_PROGRAM_ID,
} from './utils.js';
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token';

export class SolanaTBTCBridge<N extends Network, C extends SolanaChains>
  implements TBTCBridge<N, C>
{
  gateway: Program<WormholeGateway>;
  tokenBridgeId: PublicKey;
  coreBridgeId: PublicKey;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: Connection,
    readonly contracts: Contracts,
  ) {
    if (this.network !== 'Mainnet') {
      throw new Error('TBTC is only supported on Mainnet');
    }

    if (!this.contracts.tbtc) {
      throw new Error('TBTC contract address is required');
    }

    if (!this.contracts.tokenBridge) {
      throw new Error('TokenBridge contract address is required');
    }

    if (!this.contracts.coreBridge) {
      throw new Error('CoreBridge contract address is required');
    }

    this.gateway = new Program<WormholeGateway>(
      WormholeGatewayIdl,
      this.contracts.tbtc,
      {
        connection,
      },
    );
    this.tokenBridgeId = new PublicKey(this.contracts.tokenBridge);
    this.coreBridgeId = new PublicKey(this.contracts.coreBridge);
  }

  static async fromRpc<N extends Network>(
    connection: Connection,
    config: ChainsConfig<N, Platform>,
  ): Promise<SolanaTBTCBridge<N, SolanaChains>> {
    const [network, chain] = await SolanaPlatform.chainFromRpc(connection);

    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new SolanaTBTCBridge(
      network as N,
      chain,
      connection,
      conf.contracts,
    );
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<SolanaUnsignedTransaction<N, C>> {
    const senderPk = new SolanaAddress(sender).unwrap();

    const custodian = getCustodianPda(this.gateway.programId);

    const { tbtcMint, wrappedTbtcToken, wrappedTbtcMint } =
      await this.gateway.account.custodian.fetch(custodian);

    const tokenBridgeWrappedAsset = deriveWrappedMetaKey(
      this.tokenBridgeId,
      wrappedTbtcMint,
    );

    const tokenBridgeConfig = deriveTokenBridgeConfigKey(this.tokenBridgeId);

    const tokenBridgeTransferAuthority = deriveAuthoritySignerKey(
      this.tokenBridgeId,
    );

    const coreFeeCollector = coreUtils.deriveFeeCollectorKey(this.coreBridgeId);

    const { sequence } = await coreUtils.getProgramSequenceTracker(
      this.connection,
      this.tokenBridgeId,
      this.coreBridgeId,
    );

    // NOTE: There is a race condition where the sequence changes
    // before the transaction is confirmed. This would cause the
    // transaction to fail.
    const coreMessage = getCoreMessagePda(this.gateway.programId, sequence);

    const coreBridgeData = coreUtils.deriveWormholeBridgeDataKey(
      this.coreBridgeId,
    );

    const tokenBridgeCoreEmitter = coreUtils.deriveWormholeEmitterKey(
      this.tokenBridgeId,
    );

    const coreEmitterSequence = coreUtils.deriveEmitterSequenceKey(
      tokenBridgeCoreEmitter,
      this.coreBridgeId,
    );

    const gatewayInfo = getGatewayInfoPda(
      this.gateway.programId,
      recipient.chain,
    );

    const tokenBridgeSender = deriveSenderAccountKey(this.gateway.programId);

    const args = {
      amount: new BN(amount.toString()),
      recipientChain: toChainId(recipient.chain),
      recipient: [...recipient.address.toUniversalAddress().toUint8Array()],
      nonce: 0,
    };

    const ata = await getAssociatedTokenAddress(tbtcMint, senderPk);

    const toGateway = contracts.tbtc.get(this.network, recipient.chain);

    const commonAccounts = {
      custodian,
      wrappedTbtcToken,
      wrappedTbtcMint,
      tbtcMint,
      senderToken: ata,
      sender: senderPk,
      tokenBridgeConfig,
      tokenBridgeWrappedAsset,
      tokenBridgeTransferAuthority,
      coreBridgeData,
      coreMessage,
      tokenBridgeCoreEmitter,
      coreEmitterSequence,
      coreFeeCollector,
      clock: SYSVAR_CLOCK_PUBKEY,
      rent: SYSVAR_RENT_PUBKEY,
      tokenBridgeProgram: this.tokenBridgeId,
      coreBridgeProgram: this.coreBridgeId,
    };

    const ix = toGateway
      ? await this.gateway.methods
          .sendTbtcGateway({ ...args })
          .accounts({
            ...commonAccounts,
            gatewayInfo,
            tokenBridgeSender,
          })
          .instruction()
      : await this.gateway.methods
          .sendTbtcWrapped({
            ...args,
            arbiterFee: new BN(0),
          })
          .accounts(commonAccounts)
          .instruction();

    const { blockhash } = await this.connection.getLatestBlockhash();

    const messageV0 = MessageV0.compile({
      instructions: [ix],
      payerKey: senderPk,
      recentBlockhash: blockhash,
    });

    const transaction = new VersionedTransaction(messageV0);

    yield this.createUnsignedTransaction({ transaction }, 'TBTCBridge.Send');
  }

  async *redeem(sender: AccountAddress<C>, vaa: TBTCBridge.VAA) {
    if (vaa.payloadName !== 'GatewayTransfer') {
      throw new Error('Invalid VAA payload');
    }

    const core = new SolanaWormholeCore(
      this.network,
      this.chain,
      this.connection,
      this.contracts,
    );

    yield* core.postVaa(sender, vaa);

    const instructions: TransactionInstruction[] = [];

    const senderPk = new SolanaAddress(sender).unwrap();
    const recipientPk = vaa.payload.payload.recipient
      .toNative(this.chain)
      .unwrap();

    const custodian = getCustodianPda(this.gateway.programId);

    const { tbtcMint, wrappedTbtcToken, wrappedTbtcMint } =
      await this.gateway.account.custodian.fetch(custodian);

    const ata = await getAssociatedTokenAddress(tbtcMint, recipientPk);

    const ataExists = await this.connection.getAccountInfo(ata);
    if (!ataExists) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          senderPk,
          ata,
          recipientPk,
          tbtcMint,
        ),
      );
    }

    const tokenBridgeWrappedAsset = deriveWrappedMetaKey(
      this.tokenBridgeId,
      wrappedTbtcMint,
    );

    const wrappedTokenAta = await getAssociatedTokenAddress(
      wrappedTbtcMint,
      recipientPk,
    );

    instructions.push(
      await this.gateway.methods
        .receiveTbtc([...vaa.hash])
        .accounts({
          payer: senderPk,
          custodian,
          postedVaa: coreUtils.derivePostedVaaKey(
            this.coreBridgeId,
            Buffer.from(vaa.hash),
          ),
          tokenBridgeClaim: coreUtils.deriveClaimKey(
            this.tokenBridgeId,
            vaa.emitterAddress.toUint8Array(),
            toChainId(vaa.emitterChain),
            vaa.sequence,
          ),
          wrappedTbtcToken,
          wrappedTbtcMint,
          tbtcMint,
          recipientToken: ata,
          recipient: recipientPk,
          recipientWrappedToken: wrappedTokenAta,
          tbtcConfig: getConfigPda(),
          tbtcMinterInfo: getMinterInfoPda(custodian),
          tokenBridgeConfig: deriveTokenBridgeConfigKey(this.tokenBridgeId),
          tokenBridgeRegisteredEmitter: deriveEndpointKey(
            this.tokenBridgeId,
            toChainId(vaa.emitterChain),
            vaa.emitterAddress.toUint8Array(),
          ),
          tokenBridgeWrappedAsset,
          tokenBridgeMintAuthority: deriveMintAuthorityKey(this.tokenBridgeId),
          rent: SYSVAR_RENT_PUBKEY,
          tbtcProgram: TBTC_PROGRAM_ID,
          tokenBridgeProgram: this.tokenBridgeId,
          coreBridgeProgram: this.coreBridgeId,
        })
        .instruction(),
    );

    const { blockhash } = await this.connection.getLatestBlockhash();

    const messageV0 = MessageV0.compile({
      instructions,
      payerKey: senderPk,
      recentBlockhash: blockhash,
    });

    const transaction = new VersionedTransaction(messageV0);

    yield this.createUnsignedTransaction({ transaction }, 'TBTCBridge.Send');
  }

  private createUnsignedTransaction(
    txReq: SolanaTransaction,
    description: string,
  ): SolanaUnsignedTransaction<N, C> {
    return new SolanaUnsignedTransaction(
      txReq,
      this.network,
      this.chain,
      description,
      false,
    );
  }
}
