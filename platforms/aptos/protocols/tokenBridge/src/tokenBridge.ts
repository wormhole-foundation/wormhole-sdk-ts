import {
  ChainAddress,
  ChainId,
  ChainsConfig,
  Contracts,
  NativeAddress,
  Network,
  RpcConnection,
  TokenBridge,
  TokenId,
  encoding,
  nativeChainAddress,
  serialize,
  sha3_256,
  toChainId,
  toNative,
} from "@wormhole-foundation/connect-sdk";
import {
  AnyAptosAddress,
  AptosChainName,
  AptosPlatform,
  AptosUnsignedTransaction,
  coalesceModuleAddress,
  isValidAptosType,
} from "@wormhole-foundation/connect-sdk-aptos";
import { AptosClient, Types } from "aptos";
import { TokenBridgeState } from "./types";

export class AptosTokenBridge implements TokenBridge<"Aptos"> {
  readonly chainId: ChainId;

  readonly tokenBridgeAddress: string;
  readonly coreAddress: string;

  private constructor(
    readonly network: Network,
    readonly chain: AptosChainName,
    readonly connection: AptosClient,
    readonly contracts: Contracts,
  ) {
    this.chainId = toChainId(chain);

    const tokenBridgeAddress = contracts.tokenBridge;
    if (!tokenBridgeAddress)
      throw new Error(`TokenBridge contract Address for chain ${chain} not found`);
    this.tokenBridgeAddress = tokenBridgeAddress;

    const coreBridgeAddress = contracts.coreBridge;
    if (!coreBridgeAddress)
      throw new Error(`CoreBridge contract Address for chain ${chain} not found`);

    this.coreAddress = coreBridgeAddress;
  }

  static async fromRpc(
    connection: RpcConnection<"Aptos">,
    config: ChainsConfig,
  ): Promise<AptosTokenBridge> {
    const [network, chain] = await AptosPlatform.chainFromRpc(connection);
    return new AptosTokenBridge(network, chain, connection, config[chain]!.contracts);
  }

  async isWrappedAsset(token: AnyAptosAddress): Promise<boolean> {
    throw new Error("Not implemented");
  }

  async getOriginalAsset(token: AnyAptosAddress): Promise<TokenId> {
    throw new Error("Not implemented");
  }

  async hasWrappedAsset(token: TokenId): Promise<boolean> {
    try {
      await this.getWrappedAsset(token);
      return true;
    } catch (_) { }
    return false;
  }

  async getWrappedAsset(token: TokenId): Promise<NativeAddress<"Aptos">> {
    const assetFullyQualifiedType = await this.getAssetFullyQualifiedType(token);

    // check to see if we can get origin info from asset address
    await this.connection.getAccountResource(
      coalesceModuleAddress(assetFullyQualifiedType),
      `${this.tokenBridgeAddress}::state::OriginInfo`,
    );

    // if successful, we can just return the computed address
    return toNative(this.chain, assetFullyQualifiedType);
  }

  async isTransferCompleted(
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
  ): Promise<boolean> {
    const state = (
      await this.connection.getAccountResource(
        this.tokenBridgeAddress,
        `${this.tokenBridgeAddress}::state::State`
      )
    ).data as TokenBridgeState;

    const handle = state.consumed_vaas.elems.handle;

    // check if vaa hash is in consumed_vaas
    try {
      // when accessing Set<T>, key is type T and value is 0
      await this.connection.getTableItem(handle, {
        key_type: "vector<u8>",
        value_type: "u8",
        key: vaa.hash,
      });
      return true;
    } catch {
      return false;
    }
  }

  async getWrappedNative(): Promise<NativeAddress<"Aptos">> {
    throw new Error("Not implemented");
    //return toNative(this.chain, "0x1::aptos_coin::AptosCoin");
  }

  async *createAttestation(
    token: AnyAptosAddress,
    payer?: AnyAptosAddress,
  ): AsyncGenerator<AptosUnsignedTransaction> {
    const assetType = await this.getAssetFullyQualifiedType(
      nativeChainAddress([this.chain, token.toString()]),
    );
    if (!assetType) throw new Error("Invalid asset address.");

    return {
      function: `${this.tokenBridgeAddress}::attest_token::attest_token_entry`,
      type_arguments: [assetType],
      arguments: [],
    };
  }

  async *submitAttestation(
    vaa: TokenBridge.VAA<"AttestMeta">,
    payer?: AnyAptosAddress,
  ): AsyncGenerator<AptosUnsignedTransaction> {
    yield this.createUnsignedTx(
      {
        function: `${this.tokenBridgeAddress}::wrapped::create_wrapped_coin_type`,
        type_arguments: [],
        arguments: [serialize(vaa)],
      },
      "Aptos.CreateWrappedCoinType",
    );

    const assetType = await this.getAssetFullyQualifiedType(vaa.payload.token);
    if (!assetType) throw new Error("Invalid asset address.");

    yield this.createUnsignedTx(
      {
        function: `${this.tokenBridgeAddress}::wrapped::create_wrapped_coin`,
        type_arguments: [assetType],
        arguments: [serialize(vaa)],
      },
      "Aptos.CreateWrappedCoin",
    );
  }

  async *transfer(
    sender: AnyAptosAddress,
    recipient: ChainAddress,
    token: AnyAptosAddress | "native",
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<AptosUnsignedTransaction> {
    // TODO
    const fee = 0n;
    const nonce = 0n;
    const fullyQualifiedType = token.toString();

    const dstAddress = recipient.address.toUniversalAddress().toString();
    const dstChain = toChainId(recipient.chain);
    if (payload) {
      yield this.createUnsignedTx(
        {
          function: `${this.tokenBridgeAddress}::transfer_tokens::transfer_tokens_with_payload_entry`,
          type_arguments: [fullyQualifiedType],
          arguments: [amount, dstChain, dstAddress, nonce, payload],
        },
        "Aptos.TransferTokensWithPayload",
      );
    } else {
      yield this.createUnsignedTx(
        {
          function: `${this.tokenBridgeAddress}::transfer_tokens::transfer_tokens_entry`,
          type_arguments: [fullyQualifiedType],
          arguments: [amount, dstChain, dstAddress, fee, nonce],
        },
        "Aptos.TransferTokens",
      );
    }
  }

  async *redeem(
    sender: AnyAptosAddress,
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
    unwrapNative: boolean = true,
  ): AsyncGenerator<AptosUnsignedTransaction> {
    const assetType =
      vaa.payload.token.chain === this.chain
        ? await this.getTypeFromExternalAddress(vaa.payload.token.address.toString())
        : await this.getAssetFullyQualifiedType(vaa.payload.token);

    if (!assetType) throw new Error("Invalid asset address.");

    yield this.createUnsignedTx(
      {
        function: `${this.tokenBridgeAddress}::complete_transfer::submit_vaa_and_register_entry`,
        type_arguments: [assetType],
        arguments: [serialize(vaa)],
      },
      "Aptos.CompleteTransfer",
    );
  }

  async getAssetFullyQualifiedType(tokenId: TokenId): Promise<string | null> {
    // native asset
    if (tokenId.chain === this.chain) {
      // originAddress should be of form address::module::type
      if (!isValidAptosType(tokenId.address.toString())) {
        return null;
      }
      return tokenId.address.toString();
    }

    // non-native asset, derive unique address
    const wrappedAssetAddress = AptosTokenBridge.getForeignAssetAddress(this.tokenBridgeAddress, tokenId);
    return `${wrappedAssetAddress}::coin::T`;
  }

  /**
   * Given a hash, returns the fully qualified type by querying the corresponding TypeInfo.
   * @param address Hash of fully qualified type
   * @returns The fully qualified type associated with the given hash
   */
  async getTypeFromExternalAddress(address: string): Promise<string | null> {
    // get handle
    const state = (
      await this.connection.getAccountResource(
        this.tokenBridgeAddress,
        `${this.tokenBridgeAddress}::state::State`,
      )
    ).data as TokenBridgeState;

    const handle = state.native_infos.handle;

    try {
      // get type info
      const typeInfo = await this.connection.getTableItem(handle, {
        key_type: `${this.tokenBridgeAddress}::token_hash::TokenHash`,
        value_type: "0x1::type_info::TypeInfo",
        key: { hash: address },
      });

      if (!typeInfo) return null;

      const moduleName = encoding.hex.decode(typeInfo.module_name);
      const structName = encoding.hex.decode(typeInfo.struct_name);
      return `${typeInfo.account_address}::${moduleName}::${structName}`;
    } catch {
      return null;
    }
  }

  /**
   * Derive the module address for an asset defined by the given origin chain and address.
   * @param tokenBridgeAddress Address of token bridge (32 bytes)
   * @param originChain Chain ID of chain that original asset is from
   * @param originAddress Native address of asset
   * @returns The module address for the given asset
   */
  static getForeignAssetAddress(tokenBridgeAddress: string, tokenId: TokenId): string | null {
    // from https://github.com/aptos-labs/aptos-core/blob/25696fd266498d81d346fe86e01c330705a71465/aptos-move/framework/aptos-framework/sources/account.move#L90-L95

    const DERIVE_RESOURCE_ACCOUNT_SCHEME = new Uint8Array([0xff]);

    const chain = encoding.hex.decode(BigInt(toChainId(tokenId.chain)).toString(16));

    const data = encoding.concat(
      encoding.hex.decode(tokenBridgeAddress),
      chain,
      encoding.toUint8Array("::"),
      encoding.hex.decode(tokenId.address.toString()),
      DERIVE_RESOURCE_ACCOUNT_SCHEME,
    );
    return encoding.hex.encode(sha3_256(data));
  }

  private createUnsignedTx(
    txReq: Types.EntryFunctionPayload,
    description: string,
    parallelizable: boolean = false,
  ): AptosUnsignedTransaction {
    return new AptosUnsignedTransaction(txReq, this.network, this.chain, description, parallelizable);
  }
}
