import type { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import {
  contracts,
  isNative,
  nativeChainIds,
  relayInstructionsLayout,
  serialize,
  serializeLayout,
  signedQuoteLayout,
  suiExecutorTokenBridgeState,
  toChainId,
  toUniversal,
  type AccountAddress,
  type ChainAddress,
  type ChainsConfig,
  type Contracts,
  type ExecutorTokenBridge,
  type Network,
  type TokenAddress,
  type TokenId,
} from "@wormhole-foundation/sdk-connect";
import type { CoinStruct } from "@mysten/sui/client";
import {
  getPackageId,
  isSameType,
  SUI_COIN,
  SuiChains,
  SuiPlatform,
  SuiUnsignedTransaction,
} from "@wormhole-foundation/sdk-sui";
import { getTokenCoinType } from "./utils.js";

export class SuiExecutorTokenBridge<N extends Network, C extends SuiChains = SuiChains>
  implements ExecutorTokenBridge<N, C>
{
  readonly chainId: bigint;
  readonly tokenBridgeObjectId: string;
  readonly coreBridgeObjectId: string;

  // Sui-specific state for Token Bridge Relayer V4
  readonly relayerStateId: string;
  readonly relayerPackageId: string;
  readonly ptbResolverStateId: string;
  readonly relayerEmitterCap: string;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: SuiClient,
    readonly contracts: Contracts,
  ) {
    this.chainId = nativeChainIds.networkChainToNativeChainId.get(network, chain) as bigint;

    if (!contracts.tokenBridge) throw new Error(`Token Bridge contract for ${chain} not found`);
    this.tokenBridgeObjectId = contracts.tokenBridge;

    if (!contracts.coreBridge)
      throw new Error(`Wormhole Core Bridge contract for ${chain} not found`);
    this.coreBridgeObjectId = contracts.coreBridge;

    // Get Sui-specific state from constants based on the Environment
    const stateRefs = suiExecutorTokenBridgeState(network as "Mainnet" | "Testnet");
    this.relayerStateId = stateRefs.relayerStateId;
    this.relayerPackageId = stateRefs.relayerPackageId;
    this.ptbResolverStateId = stateRefs.ptbResolverStateId;
    this.relayerEmitterCap = stateRefs.relayerEmitterCap;
  }

  static async fromRpc<N extends Network>(
    provider: SuiClient,
    config: ChainsConfig<N, "Sui">,
  ): Promise<SuiExecutorTokenBridge<N, SuiChains>> {
    const [network, chain] = await SuiPlatform.chainFromRpc(provider);
    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new SuiExecutorTokenBridge(network as N, chain, provider, conf.contracts);
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    executorQuote: ExecutorTokenBridge.ExecutorQuote,
    referrerFee?: ExecutorTokenBridge.ReferrerFee,
  ): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    const tx = new Transaction();
    const senderAddress = sender.toString();

    const coinType = (isNative(token) ? SUI_COIN : token).toString();
    const messageFee = 0n;

    // Get destination relayer contract (we're departing FROM Sui, destination is never Sui)
    const dstContracts = contracts.executorTokenBridge.get(this.network, recipient.chain);
    if (!dstContracts?.relayer) {
      throw new Error(
        `Token Bridge Executor Relayer contract for destination ${recipient.chain} not found`,
      );
    }
    const dstRelayer = toUniversal(recipient.chain, dstContracts.relayer);
    // For Token Bridge transfers, dstTransferRecipient and dstExecutionAddress are the same
    const dstExecutionAddress = "0x" + Buffer.from(dstRelayer.toUint8Array()).toString("hex");

    // Serialize executor quote data
    const signedQuoteBytes = serializeLayout(signedQuoteLayout, executorQuote.signedQuote);
    const relayInstructionsBytes = serializeLayout(
      relayInstructionsLayout,
      executorQuote.relayInstructions,
    );

    // 1. Fetch and merge coins (following TokenBridge pattern)
    const coins = await SuiPlatform.getCoins(this.provider, sender, coinType);
    const [primaryCoin, ...mergeCoins] = coins.filter((coin: CoinStruct) =>
      isSameType(coin.coinType, coinType),
    );

    if (!primaryCoin) {
      throw new Error(`No coins of type ${coinType} found for sender ${sender}`);
    }

    // 2. Handle referrer fee (following Solana ExecutorTokenBridge pattern)
    let actualTransferAmount = amount;
    if (referrerFee && referrerFee.feeDbps > 0n) {
      const referrerAddress = referrerFee.referrer.address.toString();

      if (isNative(token)) {
        // For native SUI, split fee from gas
        const [refFee] = tx.splitCoins(tx.gas, [tx.pure.u64(referrerFee.feeAmount)]);
        tx.transferObjects([refFee!], tx.pure.address(referrerAddress));
      } else {
        // For tokens, merge first then split fee
        const primaryCoinInput = tx.object(primaryCoin.coinObjectId);
        if (mergeCoins.length > 0) {
          tx.mergeCoins(
            primaryCoinInput,
            mergeCoins.map((coin: CoinStruct) => tx.object(coin.coinObjectId)),
          );
        }
        const [refFee] = tx.splitCoins(primaryCoinInput, [tx.pure.u64(referrerFee.feeAmount)]);
        tx.transferObjects([refFee!], tx.pure.address(referrerAddress));
      }

      // Use remaining amount for actual transfer
      actualTransferAmount = referrerFee.remainingAmount;
    }

    // 3. Split coins for transfer (following TokenBridge pattern)
    const [transferCoin] = (() => {
      if (coinType === SUI_COIN) {
        return tx.splitCoins(tx.gas, [tx.pure.u64(actualTransferAmount)]);
      } else {
        const primaryCoinInput = tx.object(primaryCoin.coinObjectId);
        if (mergeCoins.length && !referrerFee) {
          // Only merge if we didn't already merge for referrer fee
          tx.mergeCoins(
            primaryCoinInput,
            mergeCoins.map((coin: CoinStruct) => tx.object(coin.coinObjectId)),
          );
        }
        return tx.splitCoins(primaryCoinInput, [tx.pure.u64(actualTransferAmount)]);
      }
    })();

    // 4. Split coins for fees
    const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(messageFee)]);
    const [executorPaymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(executorQuote.estimatedCost)]);

    // 5. Get verified asset from Token Bridge
    const tokenBridgePackageId = await getPackageId(this.provider, this.tokenBridgeObjectId);
    const [assetInfo] = tx.moveCall({
      target: `${tokenBridgePackageId}::state::verified_asset`,
      arguments: [tx.object(this.tokenBridgeObjectId)],
      typeArguments: [coinType],
    });

    // 6. Call relayer transfer function
    // Arguments match the Move function signature in relayer_transfer.move
    tx.moveCall({
      target: `${this.relayerPackageId}::relayer_transfer::transfer_tokens_with_relay`,
      arguments: [
        tx.object(this.relayerStateId),
        tx.object(this.coreBridgeObjectId),
        tx.object(this.tokenBridgeObjectId),
        transferCoin!,
        assetInfo!,
        feeCoin!,
        executorPaymentCoin!,
        tx.object(SUI_CLOCK_OBJECT_ID),
        tx.pure.u16(toChainId(recipient.chain)),
        tx.pure.vector("u8", Array.from(recipient.address.toUint8Array())), // recipient (32 bytes)
        tx.pure.address(dstExecutionAddress), // dst_execution_address
        tx.pure.address(senderAddress), // refund_addr
        tx.pure.vector("u8", Array.from(signedQuoteBytes)), // signed_quote
        tx.pure.vector("u8", Array.from(relayInstructionsBytes)), // relay_instructions
        tx.pure.u32(0), // nonce
      ],
      typeArguments: [coinType],
    });

    yield this.createUnsignedTx(tx, "Sui.ExecutorTokenBridge.Transfer");
  }

  async *redeem(
    _sender: AccountAddress<C>,
    vaa: ExecutorTokenBridge.VAA,
  ): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    // Get coin type from VAA
    const coinType = await getTokenCoinType(
      this.provider,
      this.tokenBridgeObjectId,
      vaa.payload.token.address.toUint8Array(),
      toChainId(vaa.payload.token.chain),
    );

    if (!coinType) {
      throw new Error("Unable to fetch token coinType from VAA");
    }

    const tx = new Transaction();

    // Get package IDs dynamically
    const coreBridgePackageId = await getPackageId(this.provider, this.coreBridgeObjectId);
    const tokenBridgePackageId = await getPackageId(this.provider, this.tokenBridgeObjectId);

    // Build 4-command redemption PTB (matching redeem.move pattern)
    // Command 1: parse_and_verify (Wormhole core)
    const [verifiedVaa] = tx.moveCall({
      target: `${coreBridgePackageId}::vaa::parse_and_verify`,
      arguments: [
        tx.object(this.coreBridgeObjectId),
        tx.pure.vector("u8", Array.from(serialize(vaa))),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    // Command 2: verify_only_once (Token Bridge replay protection)
    const [msg] = tx.moveCall({
      target: `${tokenBridgePackageId}::vaa::verify_only_once`,
      arguments: [tx.object(this.tokenBridgeObjectId), verifiedVaa!],
    });

    // Command 3: authorize_transfer (Token Bridge authorization)
    const [receipt] = tx.moveCall({
      target: `${tokenBridgePackageId}::complete_transfer_with_payload::authorize_transfer`,
      arguments: [tx.object(this.tokenBridgeObjectId), msg!],
      typeArguments: [coinType],
    });

    // Command 4: execute_vaa_v1 (TB Relayer V4 execution)
    tx.moveCall({
      target: `${this.relayerPackageId}::redeem::execute_vaa_v1`,
      arguments: [tx.object(this.relayerStateId), receipt!],
      typeArguments: [coinType],
    });

    yield this.createUnsignedTx(tx, "Sui.ExecutorTokenBridge.Redeem");
  }

  async estimateMsgValueAndGasLimit(
    _token: TokenId,
    _recipient?: ChainAddress,
  ): Promise<{ gasLimit: bigint; msgValue: bigint }> {
    // Sui uses fixed gas budget in PTB
    return {
      gasLimit: 100_000_000n, // 0.1 SUI budget
      msgValue: 0n,
    };
  }

  private createUnsignedTx(
    txReq: Transaction,
    description: string,
    parallelizable: boolean = false,
  ): SuiUnsignedTransaction<N, C> {
    return new SuiUnsignedTransaction(txReq, this.network, this.chain, description, parallelizable);
  }
}
