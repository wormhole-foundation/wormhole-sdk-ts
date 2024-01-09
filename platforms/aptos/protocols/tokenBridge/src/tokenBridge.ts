import {
  ChainAddress,
  ChainId,
  ChainsConfig,
  Contracts,
  ErrNotWrapped,
  Network,
  TokenBridge,
  TokenId,
  UniversalAddress,
  encoding,
  serialize,
  sha3_256,
  toChain,
  toChainId,
  toNative,
} from "@wormhole-foundation/connect-sdk";
import {
  APTOS_COIN,
  APTOS_SEPARATOR,
  AnyAptosAddress,
  AptosAddress,
  AptosChains,
  AptosPlatform,
  AptosPlatformType,
  AptosUnsignedTransaction,
  coalesceModuleAddress,
  isValidAptosType,
} from "@wormhole-foundation/connect-sdk-aptos";
import { AptosClient, Types } from "aptos";
import { serializeForeignAddressSeeds } from "./foreignAddress";
import { OriginInfo, TokenBridgeState } from "./types";

export class AptosTokenBridge<N extends Network, C extends AptosChains>
  implements TokenBridge<N, AptosPlatformType, C>
{
  readonly chainId: ChainId;

  readonly tokenBridgeAddress: string;
  readonly coreAddress: string;

  private constructor(
    readonly network: N,
    readonly chain: C,
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

  static async fromRpc<N extends Network>(
    connection: AptosClient,
    config: ChainsConfig<N, AptosPlatformType>,
  ): Promise<AptosTokenBridge<N, AptosChains>> {
    const [network, chain] = await AptosPlatform.chainFromRpc(connection);
    const conf = config[chain];
    if (conf.network !== network)
      throw new Error("Network mismatch " + conf.network + " !== " + network);
    return new AptosTokenBridge(network as N, chain, connection, conf.contracts);
  }

  async isWrappedAsset(token: AnyAptosAddress): Promise<boolean> {
    try {
      await this.getOriginalAsset(token);
      return true;
    } catch (_) {
      return false;
    }
  }

  async getOriginalAsset(token: AnyAptosAddress): Promise<TokenId> {
    const fqt = token.toString();
    let originInfo: OriginInfo | undefined;

    originInfo = (
      await this.connection.getAccountResource(
        fqt.split("::")[0],
        `${this.tokenBridgeAddress}::state::OriginInfo`,
      )
    ).data as OriginInfo;

    if (!originInfo) throw ErrNotWrapped;

    // wrapped asset
    const chain = toChain(parseInt(originInfo.token_chain.number));

    const address = new UniversalAddress(originInfo.token_address.external_address);

    return { chain, address };
  }

  async hasWrappedAsset(token: TokenId): Promise<boolean> {
    try {
      await this.getWrappedAsset(token);
      return true;
    } catch (_) {}
    return false;
  }

  async getWrappedAsset(token: TokenId) {
    const assetFullyQualifiedType = await this.getAssetFullyQualifiedType(token);

    // check to see if we can get origin info from asset address
    await this.connection.getAccountResource(
      coalesceModuleAddress(assetFullyQualifiedType),
      `${this.tokenBridgeAddress}::state::OriginInfo`,
    );

    // if successful, we can just return the computed address
    return toNative(this.chain, assetFullyQualifiedType);
  }

  async isTransferCompleted(vaa: TokenBridge.TransferVAA): Promise<boolean> {
    const state = (
      await this.connection.getAccountResource(
        this.tokenBridgeAddress,
        `${this.tokenBridgeAddress}::state::State`,
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

  async getWrappedNative() {
    return toNative(this.chain, APTOS_COIN);
  }

  async *createAttestation(
    token: AnyAptosAddress,
    payer?: AnyAptosAddress,
  ): AsyncGenerator<AptosUnsignedTransaction<N, C>> {
    const assetType = await this.getAssetFullyQualifiedType({
      chain: this.chain,
      address: new AptosAddress(token),
    });
    if (!assetType) throw new Error("Invalid asset address.");

    yield this.createUnsignedTx(
      {
        function: `${this.tokenBridgeAddress}::attest_token::attest_token_entry`,
        type_arguments: [assetType],
        arguments: [],
      },
      "Aptos.AttestToken",
    );
  }

  async *submitAttestation(
    vaa: TokenBridge.AttestVAA,
    payer?: AnyAptosAddress,
  ): AsyncGenerator<AptosUnsignedTransaction<N, C>> {
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
  ): AsyncGenerator<AptosUnsignedTransaction<N, C>> {
    // TODO
    const fee = 0n;
    const nonce = 0n;
    const fullyQualifiedType = token === "native" ? APTOS_COIN : token.toString();

    const dstAddress = recipient.address.toUniversalAddress().toUint8Array();
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
    vaa: TokenBridge.TransferVAA,
    unwrapNative: boolean = true,
  ): AsyncGenerator<AptosUnsignedTransaction<N, C>> {
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
    const wrappedAssetAddress = AptosTokenBridge.getForeignAssetAddress(
      this.chain,
      this.tokenBridgeAddress,
      tokenId,
    );
    return `${wrappedAssetAddress}::coin::T`;
  }

  /**
   * Given a hash, returns the fully qualified type by querying the corresponding TypeInfo.
   * @param address Hash of fully qualified type
   * @returns The fully qualified type associated with the given hash
   */
  async getTypeFromExternalAddress(address: string): Promise<string | null> {
    try {
      // get handle
      const state = (
        await this.connection.getAccountResource(
          this.tokenBridgeAddress,
          `${this.tokenBridgeAddress}::state::State`,
        )
      ).data as TokenBridgeState;
      const { handle } = state.native_infos;

      // get type info
      const typeInfo = await this.connection.getTableItem(handle, {
        key_type: `${this.tokenBridgeAddress}::token_hash::TokenHash`,
        value_type: "0x1::type_info::TypeInfo",
        key: { hash: address },
      });

      return typeInfo
        ? [
            typeInfo.account_address,
            encoding.hex.decode(typeInfo.module_name),
            encoding.hex.decode(typeInfo.struct_name),
          ].join(APTOS_SEPARATOR)
        : null;
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
  static getForeignAssetAddress(
    chain: AptosChains,
    tokenBridgeAddress: string,
    tokenId: TokenId,
  ): string {
    const data = serializeForeignAddressSeeds({
      chain: tokenId.chain,
      tokenBridgeAddress: new AptosAddress(tokenBridgeAddress).toUniversalAddress(),
      tokenId: tokenId.address.toUniversalAddress(),
    });
    return encoding.hex.encode(sha3_256(data), true);
  }

  private createUnsignedTx(
    txReq: Types.EntryFunctionPayload,
    description: string,
    parallelizable: boolean = false,
  ): AptosUnsignedTransaction<N, C> {
    return new AptosUnsignedTransaction(
      txReq,
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
