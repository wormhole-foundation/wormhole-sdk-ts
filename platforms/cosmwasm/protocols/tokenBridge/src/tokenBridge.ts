import type { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import type {
  Chain,
  ChainAddress,
  ChainsConfig,
  Contracts,
  NativeAddress,
  Network,
  TokenBridge,
  TokenId,
  TxHash,
} from "@wormhole-foundation/sdk-connect";
import {
  UniversalAddress,
  encoding,
  isNative,
  serialize,
  toChain,
  toChainId,
  toNative,
} from "@wormhole-foundation/sdk-connect";

import type {
  AnyCosmwasmAddress,
  CosmwasmChains,
  CosmwasmPlatformType,
  CosmwasmTransaction,
  WrappedRegistryResponse,
} from "@wormhole-foundation/sdk-cosmwasm";
import {
  CosmwasmAddress,
  CosmwasmPlatform,
  CosmwasmUnsignedTransaction,
  Gateway,
  buildExecuteMsg,
  computeFee,
} from "@wormhole-foundation/sdk-cosmwasm";

import "@wormhole-foundation/sdk-cosmwasm-core";

export class CosmwasmTokenBridge<N extends Network, C extends CosmwasmChains>
  implements TokenBridge<N, C>
{
  private tokenBridge: string;
  private translator?: string;
  constructor(
    readonly network: N,
    readonly chain: C,
    readonly rpc: CosmWasmClient,
    readonly contracts: Contracts,
  ) {
    const tokenBridgeAddress = this.contracts.tokenBridge!;
    if (!tokenBridgeAddress)
      throw new Error(`Wormhole Token Bridge contract for domain ${chain} not found`);

    this.tokenBridge = tokenBridgeAddress;
    // May be undefined, thats ok
    this.translator = this.contracts.translator;
    // But it cannot be an empty string (misconfiguration)
    if (this.translator !== undefined && this.translator === "")
      throw new Error("Translator address may be undefined but not empty string");
  }

  static async fromRpc<N extends Network>(
    rpc: CosmWasmClient,
    config: ChainsConfig<N, CosmwasmPlatformType>,
  ): Promise<CosmwasmTokenBridge<N, CosmwasmChains>> {
    const [network, chain] = await CosmwasmPlatform.chainFromRpc(rpc);
    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);
    return new CosmwasmTokenBridge(network as N, chain, rpc, config[chain]!.contracts);
  }

  async isWrappedAsset(token: AnyCosmwasmAddress): Promise<boolean> {
    try {
      await this.getOriginalAsset(token);
      return true;
    } catch {}
    return false;
  }

  async hasWrappedAsset(token: TokenId): Promise<boolean> {
    try {
      await this.getWrappedAsset(token);
      return true;
    } catch {}
    return false;
  }

  async getWrappedAsset(token: TokenId): Promise<NativeAddress<C>> {
    if (token.chain === this.chain) throw new Error(`Expected foreign chain, got ${token.chain}`);
    if (isNative(token.address)) throw new Error("Native asset cannot be a wrapped asset");

    const base64Addr = encoding.b64.encode(token.address.toUniversalAddress().toUint8Array());

    const { address }: WrappedRegistryResponse = await this.rpc.queryContractSmart(
      this.tokenBridge,
      {
        wrapped_registry: {
          chain: toChainId(token.chain),
          address: base64Addr,
        },
      },
    );

    return toNative(this.chain, address);
  }

  async getOriginalAsset(token: AnyCosmwasmAddress): Promise<TokenId> {
    let wrappedAddress = new CosmwasmAddress(token);

    if (wrappedAddress.denomType === "factory")
      wrappedAddress = Gateway.factoryToCw20(wrappedAddress);

    const response = await this.rpc.queryContractSmart(wrappedAddress.toString(), {
      wrapped_asset_info: {},
    });

    const origChain = toChain(response.asset_chain);
    const origAddress = encoding.b64.decode(response.asset_address);

    return {
      chain: origChain,
      address: new UniversalAddress(new Uint8Array(origAddress)),
    };
  }

  async getTokenUniversalAddress(token: NativeAddress<C>): Promise<UniversalAddress> {
    return new CosmwasmAddress(token).toUniversalAddress();
  }

  async getTokenNativeAddress(
    originChain: Chain,
    token: UniversalAddress,
  ): Promise<NativeAddress<C>> {
    return new CosmwasmAddress(token).toNative() as NativeAddress<C>;
  }

  async isTransferCompleted(vaa: TokenBridge.TransferVAA): Promise<boolean> {
    const data = encoding.b64.encode(serialize(vaa));
    const result = await this.rpc.queryContractSmart(this.tokenBridge, {
      is_vaa_redeemed: { vaa: data },
    });
    return result.is_redeemed;
  }

  async *createAttestation(
    token: AnyCosmwasmAddress,
    payer?: AnyCosmwasmAddress,
  ): AsyncGenerator<CosmwasmUnsignedTransaction<N, C>> {
    if (!payer) throw new Error("Payer required to create attestation");

    const tokenStr = new CosmwasmAddress(token).toString();
    const payerStr = new CosmwasmAddress(payer).toString();

    // TODO nonce?
    const nonce = 0;
    const assetInfo = isNative(token)
      ? {
          native_token: {
            denom: CosmwasmPlatform.getNativeDenom(this.network, this.chain),
          },
        }
      : {
          token: { contract_addr: tokenStr },
        };

    yield this.createUnsignedTx(
      {
        msgs: [
          buildExecuteMsg(payerStr, this.tokenBridge, {
            create_asset_meta: { asset_info: assetInfo, nonce },
          }),
        ],
        fee: computeFee(this.network, this.chain),
        memo: "Wormhole - Create Attestation",
      },
      "TokenBridge.createAttestation",
    );
  }

  async *submitAttestation(
    vaa: TokenBridge.AttestVAA,
    payer?: AnyCosmwasmAddress,
  ): AsyncGenerator<CosmwasmUnsignedTransaction<N, C>> {
    if (!payer) throw new Error("Payer required to submit attestation");

    const payerStr = new CosmwasmAddress(payer).toString();

    yield this.createUnsignedTx(
      {
        msgs: [
          buildExecuteMsg(payerStr, this.tokenBridge, {
            submit_vaa: { data: serialize(vaa) },
          }),
        ],
        fee: computeFee(this.network, this.chain),
        memo: "Wormhole - Submit Attestation",
      },
      "TokenBridge.submitAttestation",
    );
  }

  async *transfer(
    sender: AnyCosmwasmAddress,
    recipient: ChainAddress,
    token: AnyCosmwasmAddress,
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<CosmwasmUnsignedTransaction<N, C>> {
    const nonce = Math.round(Math.random() * 100000);
    const relayerFee = "0";

    const recipientChainId = toChainId(recipient.chain);
    // TODO: do we need to use the _native_ address for cosmos chains?
    const encodedRecipient = encoding.b64.encode(
      recipient.address.toUniversalAddress().toUint8Array(),
    );

    const denom = CosmwasmPlatform.getNativeDenom(this.network, this.chain);

    const isNativeToken = isNative(token);

    let tokenAddress = isNativeToken ? denom : token.toString();
    if (tokenAddress.startsWith("factory"))
      tokenAddress = Gateway.factoryToCw20(new CosmwasmAddress(tokenAddress)).toString();

    const senderAddress = new CosmwasmAddress(sender).toString();

    const mk_initiate_transfer = (info: object) => {
      const common = {
        asset: {
          amount: amount.toString(),
          info,
        },
        recipient_chain: recipientChainId,
        recipient: encodedRecipient,
        fee: relayerFee,
        nonce: nonce,
      };

      return payload
        ? {
            initiate_transfer_with_payload: { ...common, payload: encoding.b64.encode(payload) },
          }
        : {
            initiate_transfer: common,
          };
    };

    // this.createConvertAndTransferMessage(
    //         senderAddress,
    //         targetChain,
    //         targetAddress,
    //         relayerFee,
    //         { denom: Gateway.cw20ToFactory(token), amount },
    //       )

    if (isNativeToken) {
      const msgs = [
        buildExecuteMsg(senderAddress, this.tokenBridge, { deposit_tokens: {} }, [
          { amount: amount.toString(), denom: tokenAddress },
        ]),
        buildExecuteMsg(
          senderAddress,
          this.tokenBridge,
          mk_initiate_transfer({
            native_token: { denom: tokenAddress },
          }),
        ),
      ];

      yield this.createUnsignedTx(
        {
          msgs,
          fee: computeFee(this.network, this.chain),
          memo: "Wormhole - Initiate Native Transfer",
        },
        "TokenBridge.transferNative",
      );
    } else {
      const msgs = [
        buildExecuteMsg(senderAddress, tokenAddress, {
          increase_allowance: {
            spender: this.tokenBridge,
            amount: amount.toString(),
            expires: { never: {} },
          },
        }),
        buildExecuteMsg(
          senderAddress,
          this.tokenBridge,
          mk_initiate_transfer({
            token: { contract_addr: tokenAddress },
          }),
          [{ amount: amount.toString(), denom: tokenAddress }],
        ),
      ];

      yield this.createUnsignedTx(
        {
          msgs,
          fee: computeFee(this.network, this.chain),
          memo: "Wormhole - Initiate Transfer",
        },
        "TokenBridge.transfer",
      );
    }
  }

  async *redeem(
    sender: AnyCosmwasmAddress,
    vaa: TokenBridge.TransferVAA,
    unwrapNative: boolean = true,
  ): AsyncGenerator<CosmwasmUnsignedTransaction<N, C>> {
    // TODO: unwrapNative

    const data = encoding.b64.encode(serialize(vaa));
    const senderAddress = new CosmwasmAddress(sender).toString();

    const toTranslator =
      this.translator &&
      new CosmwasmAddress(this.translator).toUniversalAddress().equals(vaa.payload.to.address);

    const msg = toTranslator
      ? buildExecuteMsg(senderAddress, this.translator!, {
          complete_transfer_and_convert: {
            vaa: data,
          },
        })
      : buildExecuteMsg(senderAddress, this.tokenBridge, {
          submit_vaa: { data },
        });

    yield this.createUnsignedTx(
      {
        msgs: [msg],
        fee: computeFee(this.network, this.chain),
        memo: "Wormhole - Complete Transfer",
      },
      "TokenBridge.redeem",
    );
    return;
  }

  async parseTransactionDetails(txid: TxHash) {
    throw new Error("Not implemented");
  }

  async getWrappedNative(): Promise<NativeAddress<C>> {
    return toNative(this.chain, CosmwasmPlatform.getNativeDenom(this.network, this.chain));
  }

  private createUnsignedTx(
    txReq: CosmwasmTransaction,
    description: string,
    parallelizable: boolean = false,
  ): CosmwasmUnsignedTransaction<N, C> {
    return new CosmwasmUnsignedTransaction(
      txReq,
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
