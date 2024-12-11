import type { SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { SUI_CLOCK_OBJECT_ID, SUI_TYPE_ARG, normalizeSuiObjectId } from "@mysten/sui.js/utils";

import type {
  AccountAddress,
  Chain,
  ChainAddress,
  ChainsConfig,
  Contracts,
  NativeAddress,
  Network,
  Platform,
  TokenAddress,
  TokenBridge,
  TokenId,
} from "@wormhole-foundation/sdk-connect";
import {
  ErrNotWrapped,
  UniversalAddress,
  canonicalAddress,
  encoding,
  isNative,
  keccak256,
  nativeChainIds,
  serialize,
  toChain,
  toChainId,
  toNative,
} from "@wormhole-foundation/sdk-connect";

import type { SuiBuildOutput, SuiChains } from "@wormhole-foundation/sdk-sui";
import { SuiAddress } from "@wormhole-foundation/sdk-sui";
import {
  SuiPlatform,
  SuiUnsignedTransaction,
  getCoinTypeFromPackageId,
  getFieldsFromObjectResponse,
  getObjectFields,
  getOldestEmitterCapObjectId,
  getOriginalPackageId,
  getPackageId,
  getTableKeyType,
  isMoveStructObject,
  isMoveStructStruct,
  isSameType,
  isSuiCreateEvent,
  isSuiPublishEvent,
  isValidSuiType,
  publishPackage,
  trimSuiType,
  uint8ArrayToBCS,
} from "@wormhole-foundation/sdk-sui";
import { getTokenCoinType, getTokenFromTokenRegistry } from "./utils.js";

import "@wormhole-foundation/sdk-sui-core";

export class SuiTokenBridge<N extends Network, C extends SuiChains> implements TokenBridge<N, C> {
  readonly coreBridgeObjectId: string;
  readonly tokenBridgeObjectId: string;
  readonly chainId: bigint;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: SuiClient,
    readonly contracts: Contracts,
  ) {
    this.chainId = nativeChainIds.networkChainToNativeChainId.get(network, chain) as bigint;

    const tokenBridgeAddress = this.contracts.tokenBridge!;
    if (!tokenBridgeAddress)
      throw new Error(`Wormhole Token Bridge contract for domain ${chain} not found`);

    const coreBridgeAddress = this.contracts.coreBridge!;
    if (!coreBridgeAddress)
      throw new Error(`Wormhole Token Bridge contract for domain ${chain} not found`);

    this.tokenBridgeObjectId = tokenBridgeAddress;
    this.coreBridgeObjectId = coreBridgeAddress;
  }

  static async fromRpc<N extends Network>(
    provider: SuiClient,
    config: ChainsConfig<N, Platform>,
  ): Promise<SuiTokenBridge<N, SuiChains>> {
    const [network, chain] = await SuiPlatform.chainFromRpc(provider);

    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new SuiTokenBridge(network as N, chain, provider, conf.contracts);
  }

  async isWrappedAsset(token: TokenAddress<C>): Promise<boolean> {
    try {
      await this.getOriginalAsset(token);
      return true;
    } catch {
      return false;
    }
  }

  async getOriginalAsset(token: TokenAddress<C>): Promise<TokenId> {
    let coinType = (token as SuiAddress).getCoinType();
    if (!isValidSuiType(coinType)) throw new Error(`Invalid Sui type: ${coinType}`);

    const res = await getTokenFromTokenRegistry(this.provider, this.tokenBridgeObjectId, coinType);
    const fields = getFieldsFromObjectResponse(res);
    if (!fields) throw ErrNotWrapped(coinType);

    if (!isMoveStructObject(fields)) throw new Error("Expected fields to be a MoveStruct");

    if (!("value" in fields)) throw new Error("Expected a `value` key in fields of MoveStruct");

    const val = fields["value"];

    if (!isMoveStructStruct(val)) throw new Error("Expected fields to be a MoveStruct");

    // Normalize types
    const type = trimSuiType(val.type);
    coinType = trimSuiType(coinType);

    // Check if wrapped or native asset. We check inclusion instead of equality
    // because it saves us from making an additional RPC call to fetch the package ID.
    if (type.includes(`wrapped_asset::WrappedAsset<${coinType}>`)) {
      const info = val.fields["info"]!;
      if (!isMoveStructStruct(info)) throw new Error("Expected fields to be a MoveStruct");
      const address = info.fields["token_address"];
      if (!isMoveStructStruct(address)) throw new Error("Expected fields to be a MoveStruct");

      if (!isMoveStructObject(address.fields))
        throw new Error("Expected address data to be a MoveObject");

      if (!("value" in address.fields))
        throw new Error("Expected a `value` key in fields of MoveStruct");
      const addressVal = address.fields["value"];

      if (!isMoveStructStruct(addressVal)) throw new Error("Expected fields to be a MoveStruct");

      const universalAddress = new Uint8Array(addressVal.fields["data"]! as Array<number>);
      return {
        chain: toChain(Number(info.fields["token_chain"])),
        address: new UniversalAddress(universalAddress),
      };
    }

    throw ErrNotWrapped(coinType);
  }

  async getTokenUniversalAddress(token: NativeAddress<C>): Promise<UniversalAddress> {
    let coinType = (token as SuiAddress).getCoinType();
    if (!isValidSuiType(coinType)) throw new Error(`Invalid Sui type: ${coinType}`);

    const res = await getTokenFromTokenRegistry(this.provider, this.tokenBridgeObjectId, coinType);
    const fields = getFieldsFromObjectResponse(res);
    if (!fields) {
      throw new Error(
        `Token of type ${coinType} has not been registered with the token bridge. Has it been attested?`,
      );
    }

    if (!isMoveStructObject(fields)) throw new Error("Expected fields to be a MoveStruct");

    if (!("value" in fields)) throw new Error("Expected a `value` key in fields of MoveStruct");

    const val = fields["value"];

    if (!isMoveStructStruct(val)) throw new Error("Expected fields to be a MoveStruct");

    // Normalize types
    const type = trimSuiType(val.type);
    coinType = trimSuiType(coinType);

    // Check if wrapped or native asset. We check inclusion instead of equality
    // because it saves us from making an additional RPC call to fetch the package ID.
    if (type.includes(`native_asset::NativeAsset<${coinType}>`)) {
      // fields.value.fields.token_address.fields.value.fields.data
      const address = val.fields["token_address"];
      if (!isMoveStructStruct(address)) throw new Error("Expected fields to be a MoveStruct");

      if (!("value" in address.fields))
        throw new Error("Expected a `value` key in fields of MoveStruct");
      const addressVal = address.fields["value"];

      if (!isMoveStructStruct(addressVal)) throw new Error("Expected fields to be a MoveStruct");

      const universalAddress = new Uint8Array(addressVal.fields["data"]! as Array<number>);
      return new UniversalAddress(universalAddress);
    }

    throw new Error(`Token of type ${coinType} is not a native asset`);
  }

  async getTokenNativeAddress(
    originChain: Chain,
    token: UniversalAddress,
  ): Promise<NativeAddress<C>> {
    const address = await getTokenCoinType(
      this.provider,
      this.tokenBridgeObjectId,
      token.toUint8Array(),
      toChainId(originChain),
    );
    if (!address) throw new Error(`Token ${token.toString()} not found in token registry`);
    return new SuiAddress(address) as NativeAddress<C>;
  }

  async hasWrappedAsset(token: TokenId): Promise<boolean> {
    try {
      await this.getWrappedAsset(token);
      return true;
    } catch (e) {}
    return false;
  }

  async getWrappedAsset(token: TokenId<Chain>): Promise<NativeAddress<C>> {
    if (isNative(token.address))
      throw new Error("Token Address required, 'native' literal not supported");

    const address = await getTokenCoinType(
      this.provider,
      this.tokenBridgeObjectId,
      token.address.toUniversalAddress().toUint8Array(),
      toChainId(token.chain),
    );
    if (!address) throw ErrNotWrapped(canonicalAddress(token));

    return toNative(this.chain, address);
  }

  async isTransferCompleted(
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
  ): Promise<boolean> {
    const tokenBridgeStateFields = await getObjectFields(this.provider, this.tokenBridgeObjectId);

    if (!tokenBridgeStateFields)
      throw new Error("Unable to fetch object fields from token bridge state");

    const hashes = tokenBridgeStateFields["consumed_vaas"]?.fields?.hashes;

    const keyType = getTableKeyType(hashes?.fields?.items?.type);
    if (!keyType) throw new Error("Unable to get key type");

    const tableObjectId = hashes?.fields?.items?.fields?.id?.id;
    if (!tableObjectId) throw new Error("Unable to fetch consumed VAAs table");

    const response = await this.provider.getDynamicFieldObject({
      parentId: tableObjectId,
      name: {
        type: keyType,
        value: {
          data: [...keccak256(vaa.hash)],
        },
      },
    });

    if (!response.error) return true;
    if (response.error.code === "dynamicFieldNotFound") return false;

    throw new Error(`Unexpected getDynamicFieldObject response ${response.error}`);
  }

  async *createAttestation(token: TokenAddress<C>): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    const feeAmount = 0n;
    const nonce = 0n;
    const coinType = token.toString();

    const metadata = await this.provider.getCoinMetadata({ coinType });

    if (metadata === null || metadata.id === null)
      throw new Error(`Coin metadata ID for type ${coinType} not found`);

    const [coreBridgePackageId, tokenBridgePackageId] = await this.getPackageIds();

    const tx = new TransactionBlock();

    const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure(feeAmount)]);

    const [messageTicket] = tx.moveCall({
      target: `${tokenBridgePackageId}::attest_token::attest_token`,
      arguments: [tx.object(this.tokenBridgeObjectId), tx.object(metadata.id!), tx.pure(nonce)],
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

    yield this.createUnsignedTx(tx, "Sui.TokenBridge.CreateAttestation");
  }

  async *submitAttestation(
    vaa: TokenBridge.VAA<"AttestMeta">,
    sender: AccountAddress<C>,
  ): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    const [coreBridgePackageId, tokenBridgePackageId] = await this.getPackageIds();

    const senderAddress = sender.toString();

    const decimals = Math.min(vaa.payload.decimals, 8);
    const build = await this.getCoinBuildOutput(
      coreBridgePackageId,
      tokenBridgePackageId,
      decimals,
    );
    const publishTx = await publishPackage(build, senderAddress);
    yield this.createUnsignedTx(publishTx, "Sui.TokenBridge.PrepareCreateWrapped");

    // TODO: refactor this to something less embarassing
    let coinPackageId: string = "";
    let wrappedSetupObjectId: string = "";
    let coinUpgradeCapId: string = "";
    let coinMetadataObjectId: string = "";
    let versionType: string = "";
    let found = false;
    while (!found) {
      // wait for the result of the previous tx to fetch the new coinPackageId
      await new Promise((r) => setTimeout(r, 500));

      const txBlocks = await this.provider.queryTransactionBlocks({
        filter: { FromAddress: senderAddress },
        options: { showObjectChanges: true },
        limit: 3,
      });

      // Find the txblock with both the coinPackageId and wrappedType
      for (const txb of txBlocks.data) {
        if (!("objectChanges" in txb)) continue;

        for (const change of txb.objectChanges!) {
          if (isSuiPublishEvent(change) && change.packageId !== undefined) {
            coinPackageId = change.packageId;
          } else if (isSuiCreateEvent(change) && change.objectType.includes("WrappedAssetSetup")) {
            wrappedSetupObjectId = change.objectId;
            // TODO: what
            versionType = change.objectType.split(", ")[1]!.replace(">", ""); // ugh
          } else if (isSuiCreateEvent(change) && change.objectType.includes("UpgradeCap")) {
            coinUpgradeCapId = change.objectId;
          } else if (isSuiCreateEvent(change) && change.objectType.includes("CoinMetadata")) {
            coinMetadataObjectId = change.objectId;
          }
        }

        if (
          coinPackageId !== "" &&
          wrappedSetupObjectId !== "" &&
          coinUpgradeCapId !== "" &&
          coinMetadataObjectId !== ""
        ) {
          found = true;
          break;
        } else {
          coinPackageId = "";
          wrappedSetupObjectId = "";
          coinUpgradeCapId = "";
          coinMetadataObjectId = "";
        }
      }
    }

    const coinType = getCoinTypeFromPackageId(coinPackageId);

    const createTx = new TransactionBlock();
    const [txVaa] = createTx.moveCall({
      target: `${coreBridgePackageId}::vaa::parse_and_verify`,
      arguments: [
        createTx.object(this.coreBridgeObjectId),
        createTx.pure(uint8ArrayToBCS(serialize(vaa))),
        createTx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });
    const [message] = createTx.moveCall({
      target: `${tokenBridgePackageId}::vaa::verify_only_once`,
      arguments: [createTx.object(this.tokenBridgeObjectId), txVaa!],
    });

    createTx.moveCall({
      target: `${tokenBridgePackageId}::create_wrapped::complete_registration`,
      arguments: [
        createTx.object(this.tokenBridgeObjectId),
        createTx.object(coinMetadataObjectId),
        createTx.object(wrappedSetupObjectId),
        createTx.object(coinUpgradeCapId),
        message!,
      ],
      typeArguments: [coinType, versionType],
    });
    yield this.createUnsignedTx(createTx, "Sui.TokenBridge.SubmitAttestation");
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    // TODO:
    const feeAmount = 0n;
    const relayerFee = 0n;
    const nonce = 0;
    const senderAddress = sender.toString();

    const coinType = (isNative(token) ? SUI_TYPE_ARG : token).toString();

    const coins = await SuiPlatform.getCoins(this.provider, sender, coinType);
    const [primaryCoin, ...mergeCoins] = coins.filter((coin) =>
      isSameType(coin.coinType, coinType),
    );
    if (primaryCoin === undefined)
      throw new Error(`Coins array doesn't contain any coins of type ${coinType}`);

    const [coreBridgePackageId, tokenBridgePackageId] = await this.getPackageIds();

    const tx = new TransactionBlock();
    const [transferCoin] = (() => {
      if (coinType === SUI_TYPE_ARG) {
        return tx.splitCoins(tx.gas, [tx.pure(amount)]);
      } else {
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

    const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure(feeAmount)]);
    const [assetInfo] = tx.moveCall({
      target: `${tokenBridgePackageId}::state::verified_asset`,
      arguments: [tx.object(this.tokenBridgeObjectId)],
      typeArguments: [coinType],
    });

    if (!payload) {
      const [transferTicket, dust] = tx.moveCall({
        target: `${tokenBridgePackageId}::transfer_tokens::prepare_transfer`,
        arguments: [
          assetInfo!,
          transferCoin!,
          tx.pure(toChainId(recipient.chain)),
          tx.pure(uint8ArrayToBCS(recipient.address.toUint8Array())),
          tx.pure(relayerFee),
          tx.pure(nonce),
        ],
        typeArguments: [coinType],
      });

      tx.moveCall({
        target: `${tokenBridgePackageId}::coin_utils::return_nonzero`,
        arguments: [dust!],
        typeArguments: [coinType],
      });

      const [messageTicket] = tx.moveCall({
        target: `${tokenBridgePackageId}::transfer_tokens::transfer_tokens`,
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

      yield this.createUnsignedTx(tx, "Sui.TokenBridge.Transfer");
    } else {
      if (!senderAddress) throw new Error("senderAddress is required for transfer with payload");

      // Get or create a new `EmitterCap`
      let isNewEmitterCap = false;
      const emitterCap = await (async () => {
        const objectId = await getOldestEmitterCapObjectId(
          this.provider,
          coreBridgePackageId,
          senderAddress,
        );
        if (objectId !== null) {
          return tx.object(objectId);
        } else {
          const [emitterCap] = tx.moveCall({
            target: `${coreBridgePackageId}::emitter::new`,
            arguments: [tx.object(this.coreBridgeObjectId)],
          });
          isNewEmitterCap = true;
          return emitterCap;
        }
      })();

      const [transferTicket, dust] = tx.moveCall({
        target: `${tokenBridgePackageId}::transfer_tokens_with_payload::prepare_transfer`,
        arguments: [
          emitterCap!,
          assetInfo!,
          transferCoin!,
          tx.pure(toChainId(recipient.chain)),
          tx.pure(recipient.address.toUint8Array()),
          tx.pure([...payload!]),
          tx.pure(nonce),
        ],
        typeArguments: [coinType],
      });

      tx.moveCall({
        target: `${tokenBridgePackageId}::coin_utils::return_nonzero`,
        arguments: [dust!],
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

      if (isNewEmitterCap) {
        tx.transferObjects([emitterCap!], tx.pure(senderAddress));
      }

      yield this.createUnsignedTx(tx, "Sui.TokenBridge.TransferWithPayload");
    }
  }

  async *redeem(
    sender: AccountAddress<C>,
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
    unwrapNative: boolean = true,
  ): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    const coinType = await getTokenCoinType(
      this.provider,
      this.tokenBridgeObjectId,
      vaa.payload.token.address.toUint8Array(),
      toChainId(vaa.payload.token.chain),
    );
    if (!coinType) {
      throw new Error("Unable to fetch token coinType");
    }

    const [coreBridgePackageId, tokenBridgePackageId] = await this.getPackageIds();

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
    const [relayerReceipt] = tx.moveCall({
      target: `${tokenBridgePackageId}::complete_transfer::authorize_transfer`,
      arguments: [tx.object(this.tokenBridgeObjectId), tokenBridgeMessage!],
      typeArguments: [coinType!],
    });

    const [coins] = tx.moveCall({
      target: `${tokenBridgePackageId}::complete_transfer::redeem_relayer_payout`,
      arguments: [relayerReceipt!],
      typeArguments: [coinType!],
    });

    tx.moveCall({
      target: `${tokenBridgePackageId}::coin_utils::return_nonzero`,
      arguments: [coins!],
      typeArguments: [coinType!],
    });

    yield this.createUnsignedTx(tx, "Sui.TokenBridge.Redeem");
  }

  async getWrappedNative(): Promise<NativeAddress<C>> {
    return toNative(this.chain, SUI_TYPE_ARG);
  }

  private async getPackageIds(): Promise<[string, string]> {
    // TODO: can these be cached?
    return Promise.all([
      getPackageId(this.provider, this.coreBridgeObjectId),
      getPackageId(this.provider, this.tokenBridgeObjectId),
    ]);
  }

  private async getCoinBuildOutput(
    coreBridgePackageId: string,
    tokenBridgePackageId: string,
    decimals: number,
  ): Promise<SuiBuildOutput> {
    if (decimals > 8) throw new Error("Decimals is capped at 8");

    // Construct bytecode, parametrized by token bridge package ID and decimals
    const strippedTokenBridgePackageId = (
      await getOriginalPackageId(this.provider, this.tokenBridgeObjectId)
    )?.replace("0x", "");
    if (!strippedTokenBridgePackageId) {
      throw new Error(
        `Original token bridge package ID not found for object ID ${this.tokenBridgeObjectId}`,
      );
    }

    const bytecodeHex =
      "a11ceb0b060000000901000a020a14031e1704350405392d07669f01088502600ae502050cea02160004010b010c0205020d000002000201020003030c020001000104020700000700010001090801010c020a050600030803040202000302010702080007080100020800080303090002070801010b020209000901010608010105010b0202080008030209000504434f494e095478436f6e7465787408565f5f305f325f3011577261707065644173736574536574757004636f696e0e6372656174655f777261707065640b64756d6d795f6669656c6404696e697414707265706172655f726567697374726174696f6e0f7075626c69635f7472616e736665720673656e646572087472616e736665720a74785f636f6e746578740f76657273696f6e5f636f6e74726f6c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002" +
      strippedTokenBridgePackageId +
      "00020106010000000001090b0031" +
      decimals.toString(16).padStart(2, "0") +
      "0a0138000b012e110238010200";

    const bytecode = encoding.b64.encode(encoding.hex.decode(bytecodeHex));

    return {
      modules: [bytecode],
      dependencies: ["0x1", "0x2", tokenBridgePackageId, coreBridgePackageId].map((d) =>
        normalizeSuiObjectId(d),
      ),
    };
  }

  private createUnsignedTx(
    txReq: TransactionBlock,
    description: string,
    parallelizable: boolean = false,
  ): SuiUnsignedTransaction<N, C> {
    return new SuiUnsignedTransaction(txReq, this.network, this.chain, description, parallelizable);
  }
}
