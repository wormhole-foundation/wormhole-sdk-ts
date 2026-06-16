import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { parseStructTag, SUI_CLOCK_OBJECT_ID, normalizeSuiAddress } from "@mysten/sui/utils";
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
import type {
  SuiChains} from "@wormhole-foundation/sdk-sui";
import {
  bytesVectorName,
  dummyFieldName,
  getDynamicFieldValue,
  getPackageId,
  getPackageIdFromType,
  isSameType,
  u16Name,
  SUI_COIN,
  SUI_SEPARATOR,
  SuiAddress,
  SuiPlatform,
  SuiUnsignedTransaction,
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
  relayerPackageId?: string;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: SuiGrpcClient,
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
    connection: SuiGrpcClient,
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

    const tx = new Transaction();
    const feeAmount = BigInt(0); // TODO: wormhole fee
    const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(feeAmount)]);
    const [transferCoin] = await (async () => {
      if (isNative(token)) {
        return tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
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
        return tx.splitCoins(primaryCoinInput, [tx.pure.u64(amount)]);
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

    const tx = new Transaction();
    const [verifiedVAA] = tx.moveCall({
      target: `${coreBridgePackageId}::vaa::parse_and_verify`,
      arguments: [
        tx.object(this.coreBridgeObjectId),
        tx.pure.vector("u8", serialize(vaa)),
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

    // `relayer_fees` is a dynamic field (vector<u8> name) whose value is a Table {id, size};
    // the per-chain fee is a dynamic field (u16 name) under that table.
    const relayerFeesTable = await getDynamicFieldValue(
      this.connection,
      this.tokenBridgeRelayerObjectId,
      bytesVectorName("vector<u8>", encoding.bytes.encode("relayer_fees")),
    );
    if (!relayerFeesTable || !relayerFeesTable.id) {
      throw new Error("Unable to compute relayer fee");
    }

    const fee = await getDynamicFieldValue(
      this.connection,
      relayerFeesTable.id,
      u16Name("u16", toChainId(destination)),
    );
    if (fee === null || fee === undefined) {
      throw new Error("Unable to compute relayer fee");
    }

    const decimals = await SuiPlatform.getDecimals(
      this.network,
      this.chain,
      this.connection,
      token.toString(),
    );
    const swapRate = tokenInfo.swap_rate;

    const relayerFeePrecision = fields.relayer_fee_precision;
    const swapRatePrecision = fields.swap_rate_precision;

    return (
      (10n ** BigInt(decimals) * BigInt(fee) * BigInt(swapRatePrecision)) /
      (BigInt(swapRate) * BigInt(relayerFeePrecision))
    );
  }

  async maxSwapAmount(token: TokenAddress<C>): Promise<bigint> {
    const _token = isNative(token) ? SuiPlatform.nativeTokenId(this.network, this.chain) : token;

    const coinType = _token.toString();
    const { coinMetadata: metadata } = await this.connection.getCoinMetadata({ coinType });
    if (!metadata) {
      throw new Error("metadata is null");
    }

    const packageId = await this.getPackageId();

    const tx = new Transaction();
    tx.moveCall({
      // Calculates the max number of tokens the recipient can convert to native
      // Sui. The max amount of native assets the contract will swap with the
      // recipient is governed by the `max_native_swap_amount` variable.
      target: `${packageId}::redeem::calculate_max_swap_amount_in`,
      arguments: [tx.object(this.tokenBridgeRelayerObjectId), tx.pure.u8(metadata.decimals)],
      typeArguments: [coinType],
    });

    return this.simulateU64(tx);
  }

  async nativeTokenAmount(token: TokenAddress<C>, amount: bigint): Promise<bigint> {
    const _token = isNative(token) ? SuiPlatform.nativeTokenId(this.network, this.chain) : token;

    const coinType = _token.toString();
    const { coinMetadata: metadata } = await this.connection.getCoinMetadata({ coinType });
    if (!metadata) {
      throw new Error("metadata is null");
    }

    const packageId = await this.getPackageId();

    const tx = new Transaction();
    tx.moveCall({
      // Calculates the amount of native Sui that the recipient will receive
      // for swapping the `to_native_amount` of tokens.
      target: `${packageId}::redeem::calculate_native_swap_amount_out`,
      arguments: [
        tx.object(this.tokenBridgeRelayerObjectId),
        tx.pure.u64(amount),
        tx.pure.u8(metadata.decimals),
      ],
      typeArguments: [coinType],
    });

    return this.simulateU64(tx);
  }

  /** Simulate a read-only PTB and decode a single u64 (little-endian) return value. */
  private async simulateU64(tx: Transaction): Promise<bigint> {
    tx.setSenderIfNotSet(normalizeSuiAddress("0x0"));
    const result = await this.connection.simulateTransaction({
      transaction: tx,
      checksEnabled: false,
      include: { commandResults: true },
    });

    const returnValues = result.commandResults?.[0]?.returnValues;
    if (!returnValues || returnValues.length !== 1) throw Error("swap rate not set");

    // The result is a u64 in little-endian, so we reverse it for (big-endian) decode.
    return encoding.bignum.decode(new Uint8Array([...returnValues[0]!.bcs]).reverse());
  }

  async getRegisteredTokens() {
    const fields = await this.getFields();
    const registeredTokensObjectId = fields.registered_tokens.id;
    const allTokensInfo = await this.connection.listDynamicFields({
      parentId: registeredTokensObjectId,
    });

    const tokenAddresses = allTokensInfo.dynamicFields.map((token) => {
      // name.type is `${pkg}::registered_tokens::Key<${COIN}>`; the COIN is its type param.
      const coinTag = parseStructTag(token.name.type).typeParams[0];
      if (!coinTag || typeof coinTag === "string")
        throw new Error(`Unexpected registered token key: ${token.name.type}`);
      return new SuiAddress(
        [coinTag.address, coinTag.module, coinTag.name].join(SUI_SEPARATOR),
      ) as TokenAddress<C>;
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
    const packageId = await this.getPackageId();
    const registeredTokensObjectId = fields.registered_tokens.id;

    // Get the coin type (sui:SUI or ::coin::COIN)
    const parsed = new SuiAddress(coinType);
    const coin = isSameType(SUI_COIN, parsed.unwrap()) ? SUI_COIN : parsed.getCoinType();

    // registered_tokens::Key<COIN> is `{ dummy_field: bool }`; value is the TokenInfo struct.
    const name = dummyFieldName(`${packageId}::registered_tokens::Key<${coin}>`);
    const value = await getDynamicFieldValue(this.connection, registeredTokensObjectId, name);
    if (value === null || value === undefined) return null;
    return value as unknown as TokenInfo;
  }
  private async getFields() {
    if (!this.fields) {
      const { object } = await this.connection.getObject({
        objectId: this.tokenBridgeRelayerObjectId,
        include: { json: true },
      });
      if (!object || !object.json)
        throw new Error("Failed to get fields from token bridge relayer state");
      this.fields = object.json as Record<string, any>;
      // registered_tokens types are defined in the relayer package (derive from state type)
      this.relayerPackageId = getPackageIdFromType(object.type);
    }
    return this.fields!;
  }
  private async getPackageId() {
    await this.getFields();
    return this.relayerPackageId!;
  }
  private async getPackageIds(): Promise<{ coreBridge: string; tokenBridge: string }> {
    const [coreBridge, tokenBridge] = await Promise.all([
      getPackageId(this.connection, this.coreBridgeObjectId),
      getPackageId(this.connection, this.tokenBridgeObjectId),
    ]);
    return { coreBridge, tokenBridge };
  }

  private createUnsignedTx(
    txReq: Transaction,
    description: string,
    parallelizable: boolean = false,
  ): SuiUnsignedTransaction<N, C> {
    return new SuiUnsignedTransaction(txReq, this.network, this.chain, description, parallelizable);
  }
}
