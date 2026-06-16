import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import {
  SUI_CLOCK_OBJECT_ID,
  SUI_TYPE_ARG,
  normalizeSuiAddress,
  normalizeSuiObjectId,
} from "@mysten/sui/utils";

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
  bytesVectorName,
  getDynamicFieldValue,
  getObjectFields,
  getOldestEmitterCapObjectId,
  getOriginalPackageId,
  getPackageId,
  isMoveStructObject,
  isSameType,
  isValidSuiType,
  publishPackage,
  trimSuiType,
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
    readonly provider: SuiGrpcClient,
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
    provider: SuiGrpcClient,
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
    if (!res || !res.json || !("value" in res.json)) throw ErrNotWrapped(coinType);

    const val = res.json["value"];

    // In gRPC flat json the registry-entry struct type isn't on the value; it's encoded
    // on the dynamic-field object's top-level type (Field<Key<T>, WrappedAsset<T>>).
    const type = trimSuiType(res.type);
    coinType = trimSuiType(coinType);

    // Check if wrapped or native asset. We check inclusion instead of equality
    // because it saves us from making an additional RPC call to fetch the package ID.
    if (type.includes(`wrapped_asset::WrappedAsset<${coinType}>`)) {
      const info = val["info"];
      if (!isMoveStructObject(info)) throw new Error("Expected info to be a MoveStruct");
      // info.token_address.value.data is a base64-encoded 32-byte address
      const universalAddress = encoding.b64.decode(info["token_address"]["value"]["data"]);
      return {
        chain: toChain(Number(info["token_chain"])),
        address: new UniversalAddress(universalAddress),
      };
    }

    throw ErrNotWrapped(coinType);
  }

  async getTokenUniversalAddress(token: NativeAddress<C>): Promise<UniversalAddress> {
    let coinType = (token as SuiAddress).getCoinType();
    if (!isValidSuiType(coinType)) throw new Error(`Invalid Sui type: ${coinType}`);

    const res = await getTokenFromTokenRegistry(this.provider, this.tokenBridgeObjectId, coinType);
    if (!res || !res.json || !("value" in res.json)) {
      throw new Error(
        `Token of type ${coinType} has not been registered with the token bridge. Has it been attested?`,
      );
    }

    const val = res.json["value"];

    const type = trimSuiType(res.type);
    coinType = trimSuiType(coinType);

    // Check if wrapped or native asset. We check inclusion instead of equality
    // because it saves us from making an additional RPC call to fetch the package ID.
    if (type.includes(`native_asset::NativeAsset<${coinType}>`)) {
      // value.token_address.value.data is a base64-encoded 32-byte address
      const universalAddress = encoding.b64.decode(val["token_address"]["value"]["data"]);
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

    // consumed_vaas.hashes.items is a `Table` whose UID parents the dynamic fields.
    const tableObjectId = tokenBridgeStateFields["consumed_vaas"]?.["hashes"]?.["items"]?.["id"];
    if (!tableObjectId) throw new Error("Unable to fetch consumed VAAs table");

    // Key is `${coreBridgePackageId}::bytes32::Bytes32` ({ data: vector<u8> }).
    const [coreBridgePackageId] = await this.getPackageIds();
    const keyType = `${coreBridgePackageId}::bytes32::Bytes32`;
    const name = bytesVectorName(keyType, keccak256(vaa.hash));

    const value = await getDynamicFieldValue(this.provider, tableObjectId, name);
    return value !== null;
  }

  async *createAttestation(token: TokenAddress<C>): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    const feeAmount = 0n;
    const nonce = 0;
    const coinType = token.toString();

    const { coinMetadata } = await this.provider.getCoinMetadata({ coinType });

    if (coinMetadata === null || coinMetadata.id === null)
      throw new Error(`Coin metadata ID for type ${coinType} not found`);

    const [coreBridgePackageId, tokenBridgePackageId] = await this.getPackageIds();

    const tx = new Transaction();

    const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(feeAmount)]);

    const [messageTicket] = tx.moveCall({
      target: `${tokenBridgePackageId}::attest_token::attest_token`,
      arguments: [
        tx.object(this.tokenBridgeObjectId),
        tx.object(coinMetadata.id!),
        tx.pure.u32(nonce),
      ],
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

    // After the publish/prepare tx lands, the artifacts we need are owned by the sender:
    // the WrappedAssetSetup<COIN, VERSION> (whose type embeds the new coin package + version
    // type) and the coin's UpgradeCap. The CoinMetadata is a frozen object fetched by type.
    // gRPC has no transaction-query API, so we discover via the sender's owned objects.
    let coinType: string = "";
    let wrappedSetupObjectId: string = "";
    let coinUpgradeCapId: string = "";
    let coinMetadataObjectId: string = "";
    let versionType: string = "";
    let found = false;
    while (!found) {
      // wait for the result of the previous tx to be reflected in owned objects
      await new Promise((r) => setTimeout(r, 500));

      const owned = await this.provider.listOwnedObjects({
        owner: senderAddress,
        include: { json: true },
      });

      const setup = owned.objects.find((o) => o.type.includes("create_wrapped::WrappedAssetSetup"));
      if (!setup) continue;
      wrappedSetupObjectId = setup.objectId;

      // type: `${tbPkg}::create_wrapped::WrappedAssetSetup<${coinPkg}::coin::COIN, ${versionType}>`
      const generics = setup.type.substring(
        setup.type.indexOf("<") + 1,
        setup.type.lastIndexOf(">"),
      );
      const [coinTypeArg, versionArg] = generics.split(",").map((s) => s.trim());
      coinType = coinTypeArg!;
      versionType = versionArg!;
      const coinPackageId = new SuiAddress(coinType).getPackageId();

      // the coin's UpgradeCap, owned by the sender (match on its `package` field)
      const cap = owned.objects.find(
        (o) =>
          o.type.includes("package::UpgradeCap") &&
          o.json != null &&
          normalizeSuiAddress((o.json as any)["package"]) === normalizeSuiAddress(coinPackageId),
      );
      coinUpgradeCapId = cap?.objectId ?? "";

      // CoinMetadata is frozen/shared; fetch by coin type
      const { coinMetadata } = await this.provider.getCoinMetadata({ coinType });
      coinMetadataObjectId = coinMetadata?.id ?? "";

      if (wrappedSetupObjectId && coinUpgradeCapId && coinMetadataObjectId) found = true;
    }

    const createTx = new Transaction();
    const [txVaa] = createTx.moveCall({
      target: `${coreBridgePackageId}::vaa::parse_and_verify`,
      arguments: [
        createTx.object(this.coreBridgeObjectId),
        createTx.pure.vector("u8", serialize(vaa)),
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

    const tx = new Transaction();
    const [transferCoin] = (() => {
      if (coinType === SUI_TYPE_ARG) {
        return tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
      } else {
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

    const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(feeAmount)]);
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
          tx.pure.u16(toChainId(recipient.chain)),
          tx.pure.vector("u8", recipient.address.toUint8Array()),
          tx.pure.u64(relayerFee),
          tx.pure.u32(nonce),
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
          tx.pure.u16(toChainId(recipient.chain)),
          tx.pure.vector("u8", recipient.address.toUint8Array()),
          tx.pure.vector("u8", payload),
          tx.pure.u32(nonce),
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
        tx.transferObjects([emitterCap!], tx.pure.address(senderAddress));
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
    txReq: Transaction,
    description: string,
    parallelizable: boolean = false,
  ): SuiUnsignedTransaction<N, C> {
    return new SuiUnsignedTransaction(txReq, this.network, this.chain, description, parallelizable);
  }
}
