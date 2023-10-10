import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import {
  Network,
  VAA,
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
  contracts as Contracts,
  NativeAddress,
} from "@wormhole-foundation/connect-sdk";

import {
  buildExecuteMsg,
  CosmwasmTransaction,
  CosmwasmUnsignedTransaction,
  computeFee,
} from "../unsignedTransaction";
import { CosmwasmContracts } from "../contracts";
import {
  CosmwasmChainName,
  UniversalOrCosmwasm,
  WrappedRegistryResponse,
} from "../types";
import { CosmwasmPlatform } from "../platform";
import { CosmwasmAddress } from "../address";

export class CosmwasmTokenBridge implements TokenBridge<"Cosmwasm"> {
  private tokenBridge: string;
  private translator?: string;
  private constructor(
    readonly network: Network,
    readonly chain: CosmwasmChainName,
    readonly rpc: CosmWasmClient,
    readonly contracts: CosmwasmContracts,
  ) {
    this.tokenBridge = this.contracts.getTokenBridge(this.chain, this.rpc);
    if (Contracts.translator.has(network, chain)) {
      this.translator = Contracts.translator.get(network, chain);
    }
  }

  static async fromProvider(
    rpc: CosmWasmClient,
    contracts: CosmwasmContracts,
  ): Promise<CosmwasmTokenBridge> {
    const [network, chain] = await CosmwasmPlatform.chainFromRpc(rpc);
    return new CosmwasmTokenBridge(network, chain, rpc, contracts);
  }

  async isWrappedAsset(token: UniversalOrCosmwasm): Promise<boolean> {
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

    const base64Addr = Buffer.from(
      token.address.toUniversalAddress().toUint8Array(),
    ).toString("base64");

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

  async getOriginalAsset(token: UniversalOrCosmwasm): Promise<TokenId> {
    const wrappedAddress = token.toString();

    const response = await this.rpc.queryContractSmart(wrappedAddress, {
      wrapped_asset_info: {},
    });

    const origChain = toChainName(response.asset_chain);
    const origAddress = Buffer.from(response.asset_address, "base64");

    return {
      chain: origChain,
      address: new UniversalAddress(new Uint8Array(origAddress)),
    };
  }

  async isTransferCompleted(
    vaa: VAA<"Transfer"> | VAA<"TransferWithPayload">,
  ): Promise<boolean> {
    const data = Buffer.from(serialize(vaa)).toString("base64");
    const result = await this.rpc.queryContractSmart(this.tokenBridge, {
      is_vaa_redeemed: { vaa: data },
    });
    return result.is_redeemed;
  }

  async *createAttestation(
    token: UniversalOrCosmwasm | "native",
    payer?: UniversalOrCosmwasm,
  ): AsyncGenerator<CosmwasmUnsignedTransaction> {
    if (!payer) throw new Error("Payer required to create attestation");

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
            token: { contract_addr: token.toString() },
          };

    yield this.createUnsignedTx(
      {
        msgs: [
          buildExecuteMsg(payer.toString(), this.tokenBridge, {
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
    vaa: VAA<"AttestMeta">,
    payer?: UniversalOrCosmwasm,
  ): AsyncGenerator<CosmwasmUnsignedTransaction> {
    if (!payer) throw new Error("Payer required to submit attestation");

    yield this.createUnsignedTx(
      {
        msgs: [
          buildExecuteMsg(payer.toString(), this.tokenBridge, {
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
    sender: UniversalOrCosmwasm,
    recipient: ChainAddress,
    token: UniversalOrCosmwasm | "native",
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<CosmwasmUnsignedTransaction> {
    const nonce = Math.round(Math.random() * 100000);
    const relayerFee = "0";

    const recipientChainId = toChainId(recipient.chain);
    const recipientAddress = Buffer.from(
      recipient.address.toUniversalAddress().toUint8Array(),
    );

    const denom = CosmwasmPlatform.getNativeDenom(this.chain);

    const isNative = token === "native";

    const tokenAddress = isNative ? denom : token.toString();

    const senderAddress = sender.toString();

    const mk_initiate_transfer = (info: object) => {
      const common = {
        asset: {
          amount: amount.toString(),
          info,
        },
        recipient_chain: recipientChainId,
        recipient: Buffer.from(recipientAddress).toString("base64"),
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
    sender: UniversalOrCosmwasm,
    vaa: VAA<"Transfer"> | VAA<"TransferWithPayload">,
    unwrapNative: boolean = true,
  ): AsyncGenerator<CosmwasmUnsignedTransaction> {
    // TODO: unwrapNative

    const data = Buffer.from(serialize(vaa)).toString("base64");

    let msg;
    if (
      this.translator &&
      toNative(this.chain, this.translator)
        .toUniversalAddress()
        .equals(vaa.payload.to.address)
    ) {
      msg = buildExecuteMsg(sender.toString(), this.translator, {
        complete_transfer_and_convert: {
          vaa: data,
        },
      });
    } else {
      msg = buildExecuteMsg(sender.toString(), this.tokenBridge, {
        submit_vaa: { data },
      });
    }

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
