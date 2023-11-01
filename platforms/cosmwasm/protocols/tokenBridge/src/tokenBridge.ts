import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import {
  Network,
  ChainAddress,
  TokenBridge,
  TxHash,
  TokenId,
  TokenTransferTransaction,
  toNative,
  toChainName,
  UniversalAddress,
  toChainId,
  serialize,
  NativeAddress,
  encoding,
  ChainsConfig,
  Contracts,
} from "@wormhole-foundation/connect-sdk";

import {
  buildExecuteMsg,
  CosmwasmTransaction,
  CosmwasmUnsignedTransaction,
  computeFee,
  AnyCosmwasmAddress,
  CosmwasmChainName,
  WrappedRegistryResponse,
  CosmwasmPlatform,
  CosmwasmAddress,
} from "@wormhole-foundation/connect-sdk-cosmwasm";

export class CosmwasmTokenBridge implements TokenBridge<"Cosmwasm"> {
  private tokenBridge: string;
  private translator?: string;
  private constructor(
    readonly network: Network,
    readonly chain: CosmwasmChainName,
    readonly rpc: CosmWasmClient,
    readonly contracts: Contracts,
  ) {
    const tokenBridgeAddress = this.contracts.tokenBridge!;
    if (!tokenBridgeAddress)
      throw new Error(
        `Wormhole Token Bridge contract for domain ${chain} not found`,
      );

    this.tokenBridge = tokenBridgeAddress;
    // May be undefined, thats ok
    this.translator = this.contracts.translator;
  }

  static async fromRpc(
    rpc: CosmWasmClient,
    config: ChainsConfig,
  ): Promise<CosmwasmTokenBridge> {
    const [network, chain] = await CosmwasmPlatform.chainFromRpc(rpc);
    return new CosmwasmTokenBridge(
      network,
      chain,
      rpc,
      config[chain]!.contracts,
    );
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

  async getWrappedAsset(
    token: TokenId,
  ): Promise<NativeAddress<CosmwasmPlatform.Type>> {
    if (token.chain === this.chain)
      throw new Error(`Expected foreign chain, got ${token.chain}`);

    const base64Addr = encoding.b64.encode(
      token.address.toUniversalAddress().toUint8Array(),
    );

    const { address }: WrappedRegistryResponse =
      await this.rpc.queryContractSmart(this.tokenBridge, {
        wrapped_registry: {
          chain: toChainId(token.chain),
          address: base64Addr,
        },
      });

    // @ts-ignore
    return toNative(this.chain, address);
  }

  async getOriginalAsset(token: AnyCosmwasmAddress): Promise<TokenId> {
    const wrappedAddress = new CosmwasmAddress(token).toString();

    const response = await this.rpc.queryContractSmart(wrappedAddress, {
      wrapped_asset_info: {},
    });

    const origChain = toChainName(response.asset_chain);
    const origAddress = encoding.b64.decode(response.asset_address);

    return {
      chain: origChain,
      address: new UniversalAddress(new Uint8Array(origAddress)),
    };
  }

  async isTransferCompleted(
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
  ): Promise<boolean> {
    const data = encoding.b64.encode(serialize(vaa));
    const result = await this.rpc.queryContractSmart(this.tokenBridge, {
      is_vaa_redeemed: { vaa: data },
    });
    return result.is_redeemed;
  }

  async *createAttestation(
    token: AnyCosmwasmAddress | "native",
    payer?: AnyCosmwasmAddress,
  ): AsyncGenerator<CosmwasmUnsignedTransaction> {
    if (!payer) throw new Error("Payer required to create attestation");

    const tokenStr = new CosmwasmAddress(token).toString();
    const payerStr = new CosmwasmAddress(payer).toString();

    // TODO nonce?
    const nonce = 0;
    const assetInfo =
      token === "native"
        ? {
            native_token: {
              denom: CosmwasmPlatform.getNativeDenom(this.chain),
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
        fee: computeFee(this.chain),
        memo: "Wormhole - Create Attestation",
      },
      "TokenBridge.createAttestation",
    );
  }

  async *submitAttestation(
    vaa: TokenBridge.VAA<"AttestMeta">,
    payer?: AnyCosmwasmAddress,
  ): AsyncGenerator<CosmwasmUnsignedTransaction> {
    if (!payer) throw new Error("Payer required to submit attestation");

    const payerStr = new CosmwasmAddress(payer).toString();

    yield this.createUnsignedTx(
      {
        msgs: [
          buildExecuteMsg(payerStr, this.tokenBridge, {
            submit_vaa: { data: serialize(vaa) },
          }),
        ],
        fee: computeFee(this.chain),
        memo: "Wormhole - Submit Attestation",
      },
      "TokenBridge.submitAttestation",
    );
  }

  async *transfer(
    sender: AnyCosmwasmAddress,
    recipient: ChainAddress,
    token: AnyCosmwasmAddress | "native",
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<CosmwasmUnsignedTransaction> {
    const nonce = Math.round(Math.random() * 100000);
    const relayerFee = "0";

    const recipientChainId = toChainId(recipient.chain);
    // TODO: do we need to use the _native_ address for cosmos chains?
    const encodedRecipient = encoding.b64.encode(
      recipient.address.toUniversalAddress().toUint8Array(),
    );

    const denom = CosmwasmPlatform.getNativeDenom(this.chain);

    const isNative = token === "native";

    const tokenAddress = isNative ? denom : token.toString();

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
            initiate_transfer_with_payload: { ...common, payload },
          }
        : {
            initiate_transfer: common,
          };
    };

    if (isNative) {
      const msgs = [
        buildExecuteMsg(
          senderAddress,
          this.tokenBridge,
          { deposit_tokens: {} },
          [{ amount: amount.toString(), denom: tokenAddress }],
        ),
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
          fee: computeFee(this.chain),
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
        ),
      ];

      yield this.createUnsignedTx(
        {
          msgs,
          fee: computeFee(this.chain),
          memo: "Wormhole - Initiate Transfer",
        },
        "TokenBridge.transfer",
      );
    }
    return;
  }

  async *redeem(
    sender: AnyCosmwasmAddress,
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
    unwrapNative: boolean = true,
  ): AsyncGenerator<CosmwasmUnsignedTransaction> {
    // TODO: unwrapNative

    const data = encoding.b64.encode(serialize(vaa));
    const senderAddress = new CosmwasmAddress(sender).toString();

    const toTranslator =
      this.translator &&
      toNative(this.chain, this.translator)
        .toUniversalAddress()
        .equals(vaa.payload.to.address);

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
        fee: computeFee(this.chain),
        memo: "Wormhole - Complete Transfer",
      },
      "TokenBridge.redeem",
    );
    return;
  }

  async parseTransactionDetails(
    txid: TxHash,
  ): Promise<TokenTransferTransaction[]> {
    throw new Error("Not implemented");
  }

  async getWrappedNative(): Promise<NativeAddress<CosmwasmPlatform.Type>> {
    return toNative(this.chain, CosmwasmPlatform.getNativeDenom(this.chain));
  }

  private createUnsignedTx(
    txReq: CosmwasmTransaction,
    description: string,
    parallelizable: boolean = false,
  ): CosmwasmUnsignedTransaction {
    return new CosmwasmUnsignedTransaction(
      txReq,
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
