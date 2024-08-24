import { StructTag } from "@mysten/sui.js/bcs";
import type { SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { parseStructTag, SUI_CLOCK_OBJECT_ID } from "@mysten/sui.js/utils";
import {
  encoding,
  isNative,
  serialize,
  toChainId,
  type AccountAddress,
  type AutomaticTokenBridge,
  type Chain,
  type ChainAddress,
  type ChainsConfig,
  type Contracts,
  type Network,
  type Platform,
  type TokenAddress,
} from "@wormhole-foundation/sdk-connect";
import {
  getObjectFields,
  getPackageId,
  isMoveStructId,
  isMoveStructStruct,
  isSameType,
  SUI_COIN,
  SUI_SEPARATOR,
  SuiAddress,
  SuiChains,
  SuiPlatform,
  SuiUnsignedTransaction,
  uint8ArrayToBCS,
} from "@wormhole-foundation/sdk-sui";
import "@wormhole-foundation/sdk-sui-core";
import { getTokenCoinType } from "./utils.js";

export interface TokenInfo {
  max_native_swap_amount: string;
  swap_enabled: boolean;
  swap_rate: string;
}

export class SuiAutomaticTokenBridge<N extends Network, C extends SuiChains>
  implements AutomaticTokenBridge<N, C>
{
  tokenBridgeRelayerObjectId: string;
  coreBridgeObjectId: string;
  tokenBridgeObjectId: string;
  fields?: Record<string, any>;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: SuiClient,
    readonly contracts: Contracts,
  ) {
    const { tokenBridge, tokenBridgeRelayer, coreBridge } = contracts;
    if (!tokenBridge || !tokenBridgeRelayer || !coreBridge)
      throw new Error(`Some object IDs for ${chain} Automatic Token Bridge not found`);

    this.tokenBridgeRelayerObjectId = tokenBridgeRelayer;
    this.tokenBridgeObjectId = tokenBridge;
    this.coreBridgeObjectId = coreBridge;
  }

  static async fromRpc<N extends Network>(
    connection: SuiClient,
    config: ChainsConfig<N, Platform>,
  ): Promise<SuiAutomaticTokenBridge<N, SuiChains>> {
    const [network, chain] = await SuiPlatform.chainFromRpc(connection);
    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch for chain ${chain}: ${conf.network} != ${network}`);

    return new SuiAutomaticTokenBridge(network as N, chain, connection, conf.contracts);
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    nativeGas?: bigint | undefined,
  ) {
    const tokenAddress = new SuiAddress(
      isNative(token) ? SuiPlatform.nativeTokenId(this.network, this.chain).address : token,
    );
    const coinType: string = tokenAddress.getCoinType();

    const { coreBridge: coreBridgePackageId, tokenBridge: tokenBridgePackageId } =
      await this.getPackageIds();

    const tx = new TransactionBlock();
    const feeAmount = BigInt(0); // TODO: wormhole fee
    const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure(feeAmount)]);
    const [transferCoin] = await (async () => {
      if (isNative(token)) {
        return tx.splitCoins(tx.gas, [tx.pure(amount)]);
      } else {
        const coins = await SuiPlatform.getCoins(this.connection, sender, coinType);
        const [primaryCoin, ...mergeCoins] = coins.filter((coin) => coin.coinType === coinType);
        if (primaryCoin === undefined) {
          throw new Error(`Coins array doesn't contain any coins of type ${coinType}`);
        }
        const primaryCoinInput = tx.object(primaryCoin.coinObjectId);
        if (mergeCoins.length) {
          tx.mergeCoins(
            primaryCoinInput,
            mergeCoins.map((coin) => tx.object(coin.coinObjectId)),
          );
        }
        return tx.splitCoins(primaryCoinInput, [tx.pure(amount)]);
      }
    })();

    const [assetInfo] = tx.moveCall({
      target: `${tokenBridgePackageId}::state::verified_asset`,
      arguments: [tx.object(this.tokenBridgeObjectId)],
      typeArguments: [coinType],
    });

    const suiRelayerPackageId = await this.getPackageId();
    const [transferTicket] = tx.moveCall({
      target: `${suiRelayerPackageId}::transfer::transfer_tokens_with_relay`,
      arguments: [
        tx.object(this.tokenBridgeRelayerObjectId),
        transferCoin!,
        assetInfo!,
        tx.pure.u64(nativeGas ?? 0n),
        tx.pure.u16(toChainId(recipient.chain)),
        tx.pure.address(encoding.hex.encode(recipient.address.toUint8Array(), true)),
        tx.pure.u32(123),
      ],
      typeArguments: [coinType],
    });

    const [messageTicket] = tx.moveCall({
      target: `${tokenBridgePackageId}::transfer_tokens_with_payload::transfer_tokens_with_payload`,
      arguments: [tx.object(this.tokenBridgeObjectId), transferTicket!],
      typeArguments: [coinType],
    });
    tx.moveCall({
      target: `${coreBridgePackageId}::publish_message::publish_message`,
      arguments: [
        tx.object(this.coreBridgeObjectId),
        feeCoin!,
        messageTicket!,
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    yield this.createUnsignedTx(tx, "AutomaticTokenBridge.transfer");
  }

  async *redeem(sender: AccountAddress<C>, vaa: AutomaticTokenBridge.VAA) {
    const { coreBridge: coreBridgePackageId, tokenBridge: tokenBridgePackageId } =
      await this.getPackageIds();

    const { address: tokenAddress, chain: tokenChain } = vaa.payload.token;

    const coinType = await getTokenCoinType(
      this.connection,
      this.tokenBridgeObjectId,
      tokenAddress.toUniversalAddress().toUint8Array(),
      toChainId(tokenChain),
    );
    if (!coinType) {
      throw new Error("Unable to fetch token coinType");
    }

    const tx = new TransactionBlock();
    const [verifiedVAA] = tx.moveCall({
      target: `${coreBridgePackageId}::vaa::parse_and_verify`,
      arguments: [
        tx.object(this.coreBridgeObjectId),
        tx.pure(uint8ArrayToBCS(serialize(vaa))),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    const [tokenBridgeMessage] = tx.moveCall({
      target: `${tokenBridgePackageId}::vaa::verify_only_once`,
      arguments: [tx.object(this.tokenBridgeObjectId), verifiedVAA!],
    });

    const [redeemerReceipt] = tx.moveCall({
      target: `${tokenBridgePackageId}::complete_transfer_with_payload::authorize_transfer`,
      arguments: [tx.object(this.tokenBridgeObjectId), tokenBridgeMessage!],
      typeArguments: [coinType],
    });

    const packageId = await this.getPackageId();

    tx.moveCall({
      target: `${packageId}::redeem::complete_transfer`,
      arguments: [tx.object(this.tokenBridgeRelayerObjectId), redeemerReceipt!],
      typeArguments: [coinType],
    });
    yield this.createUnsignedTx(tx, "AutomaticTokenBridge.redeem");
  }

  async getRelayerFee(destination: Chain, token: TokenAddress<C>): Promise<bigint> {
    const _token = isNative(token) ? SuiPlatform.nativeTokenId(this.network, this.chain) : token;

    const tokenInfo = await this.getTokenInfo(_token.toString());
    if (tokenInfo === null) {
      throw new Error("Unsupported token for relay");
    }

    const fields = await this.getFields();

    const relayerFees = await this.connection.getDynamicFieldObject({
      parentId: this.tokenBridgeRelayerObjectId,
      name: { type: "vector<u8>", value: Array.from(encoding.bytes.encode("relayer_fees")) },
    });

    if (!relayerFees.data || !relayerFees.data.content) {
      if (relayerFees.error)
        throw new Error("Failed to get relayer fees: " + JSON.stringify(relayerFees.error));
      throw new Error("Unable to compute relayer fee");
    }

    const { content } = relayerFees.data;
    if (!isMoveStructStruct(content) || !isMoveStructId(content.fields.id)) {
      throw new Error("Unable to compute relayer fee");
    }

    const entry = await this.connection.getDynamicFieldObject({
      parentId: content.fields.id.id,
      name: { type: "u16", value: toChainId(destination) },
    });
    if (!entry.data || !entry.data.content) {
      if (entry.error)
        throw new Error("Failed to get relayer fees: " + JSON.stringify(relayerFees.error));
      throw new Error("Unable to compute relayer fee");
    }

    const { content: feeData } = entry.data;
    if (!isMoveStructStruct(feeData)) {
      throw new Error("Unable to compute relayer fee");
    }

    const decimals = await SuiPlatform.getDecimals(this.chain, this.connection, token.toString());
    const swapRate = tokenInfo.swap_rate;

    const relayerFeePrecision = fields.relayer_fee_precision;
    const swapRatePrecision = fields.swap_rate_precision;
    const fee = feeData.fields.value! as number;

    return (
      (10n ** BigInt(decimals) * BigInt(fee) * BigInt(swapRatePrecision)) /
      (BigInt(swapRate) * BigInt(relayerFeePrecision))
    );
  }

  async maxSwapAmount(token: TokenAddress<C>): Promise<bigint> {
    const _token = isNative(token) ? SuiPlatform.nativeTokenId(this.network, this.chain) : token;

    const coinType = _token.toString();
    const metadata = await this.connection.getCoinMetadata({ coinType });
    if (!metadata) {
      throw new Error("metadata is null");
    }

    const packageId = await this.getPackageId();

    const tx = new TransactionBlock();
    tx.moveCall({
      // Calculates the max number of tokens the recipient can convert to native
      // Sui. The max amount of native assets the contract will swap with the
      // recipient is governed by the `max_native_swap_amount` variable.
      target: `${packageId}::redeem::calculate_max_swap_amount_in`,
      arguments: [tx.object(this.tokenBridgeRelayerObjectId), tx.pure(metadata.decimals)],
      typeArguments: [coinType],
    });

    const result = await this.connection.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: encoding.hex.encode(new Uint8Array(32)),
    });

    if (
      !result.results ||
      result.results.length == 0 ||
      !result.results[0]?.returnValues ||
      result.results[0]?.returnValues.length !== 1
    )
      throw Error("swap rate not set");

    // The result is a u64 in little-endian, so we need to reverse it for decode
    return encoding.bignum.decode(
      new Uint8Array(result.results[0].returnValues[0]![0]!.toReversed()),
    );
  }

  async nativeTokenAmount(token: TokenAddress<C>, amount: bigint): Promise<bigint> {
    const _token = isNative(token) ? SuiPlatform.nativeTokenId(this.network, this.chain) : token;

    const coinType = _token.toString();
    const metadata = await this.connection.getCoinMetadata({ coinType });
    if (!metadata) {
      throw new Error("metadata is null");
    }

    const packageId = await this.getPackageId();

    const tx = new TransactionBlock();
    tx.moveCall({
      // Calculates the amount of native Sui that the recipient will receive
      // for swapping the `to_native_amount` of tokens.
      target: `${packageId}::redeem::calculate_native_swap_amount_out`,
      arguments: [
        tx.object(this.tokenBridgeRelayerObjectId),
        tx.pure(amount),
        tx.pure(metadata.decimals),
      ],
      typeArguments: [coinType],
    });

    const result = await this.connection.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: encoding.hex.encode(new Uint8Array(32)),
    });

    if (
      !result.results ||
      result.results.length == 0 ||
      !result.results[0]?.returnValues ||
      result.results[0]?.returnValues.length !== 1
    )
      throw Error("swap rate not set");

    // The result is a u64 in little-endian, so we need to reverse it for decode
    return encoding.bignum.decode(
      new Uint8Array(result.results[0].returnValues[0]![0]!.toReversed()),
    );
  }

  async getRegisteredTokens() {
    const fields = await this.getFields();
    const registeredTokensObjectId = fields.registered_tokens.fields.id.id;
    const allTokensInfo = await this.connection.getDynamicFields({
      parentId: registeredTokensObjectId,
    });

    const tokenAddresses = allTokensInfo.data.map((token) => {
      const { address, module, name } = parseStructTag(token.objectType)
        .typeParams[0]! as unknown as StructTag;
      return new SuiAddress([address, module, name].join(SUI_SEPARATOR)) as TokenAddress<C>;
    });

    return tokenAddresses;
  }

  async isRegisteredToken(token: TokenAddress<C>): Promise<boolean> {
    const tokenAddress = new SuiAddress(
      isNative(token) ? SuiPlatform.nativeTokenId(this.network, this.chain).address : token,
    ).unwrap();

    try {
      return (await this.getTokenInfo(tokenAddress)) !== null;
    } catch (e) {
      console.error(e);
    }
    return false;
  }

  private async getTokenInfo(coinType: string): Promise<TokenInfo | null> {
    const fields = await this.getFields();
    // Pulling the package id from the registered_tokens field
    const registeredTokensType = new SuiAddress(fields.registered_tokens.type);
    const packageId = registeredTokensType.getPackageId();
    const registeredTokensObjectId = fields.registered_tokens.fields.id.id;

    // Get the coin type (sui:SUI or ::coin::COIN)
    const parsed = new SuiAddress(coinType);
    const coin = isSameType(SUI_COIN, parsed.unwrap()) ? SUI_COIN : parsed.getCoinType();
    try {
      // if the token isn't registered, then this will throw
      const tokenInfo = await this.connection.getDynamicFieldObject({
        parentId: registeredTokensObjectId,
        name: {
          type: `${packageId}::registered_tokens::Key<${coin}>`,
          value: { dummy_field: false },
        },
      });

      if (tokenInfo.error)
        throw new Error("Failed to get token info: " + JSON.stringify(tokenInfo.error));

      if (!tokenInfo.data || !tokenInfo.data.content)
        throw new Error("Failed to get token info: " + JSON.stringify(tokenInfo));

      const { content } = tokenInfo.data;
      if (isMoveStructStruct(content) && isMoveStructStruct(content.fields.value)) {
        return content.fields.value.fields as unknown as TokenInfo;
      }

      return null;
    } catch (e: any) {
      if (e?.code === -32000 && e.message?.includes("RPC Error")) {
        console.error(e);
        return null;
      }
      throw e;
    }
  }
  private async getFields() {
    if (!this.fields) {
      const fields = await getObjectFields(this.connection, this.tokenBridgeRelayerObjectId);
      if (fields === null) throw new Error("Failed to get fields from token bridge relayer state");
      this.fields = fields;
    }
    return this.fields!;
  }
  private async getPackageId() {
    const fields = await this.getFields();
    return new SuiAddress(fields.registered_tokens.type).getPackageId();
  }
  private async getPackageIds(): Promise<{ coreBridge: string; tokenBridge: string }> {
    const [coreBridge, tokenBridge] = await Promise.all([
      getPackageId(this.connection, this.coreBridgeObjectId),
      getPackageId(this.connection, this.tokenBridgeObjectId),
    ]);
    return { coreBridge, tokenBridge };
  }

  private createUnsignedTx(
    txReq: TransactionBlock,
    description: string,
    parallelizable: boolean = false,
  ): SuiUnsignedTransaction<N, C> {
    return new SuiUnsignedTransaction(txReq, this.network, this.chain, description, parallelizable);
  }
}
