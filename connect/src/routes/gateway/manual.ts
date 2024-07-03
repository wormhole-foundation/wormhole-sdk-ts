import { ManualRoute, type StaticRouteMethods } from "../route.js";
import { type Chain, type Network } from "@wormhole-foundation/sdk-base";
import type {
  ChainAddress,
  ChainContext,
  GatewayTransferDetails,
  Signer,
  TokenId,
} from "@wormhole-foundation/sdk-definitions";
import type {
  Quote,
  QuoteResult,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types.js";
import { GatewayTransfer } from "../../protocols/index.js";
import { amount } from "@wormhole-foundation/sdk-base";
import type {
  AttestationReceipt as _AttestationReceipt,
  TransferReceipt as _TransferReceipt,
  SourceInitiatedTransferReceipt,
} from "../../types.js";
import { TransferState } from "../../types.js";
import { Wormhole } from "../../wormhole.js";

export namespace ManualGatewayRoute {
  export type Options = {
    payload?: Uint8Array;
  };

  export type NormalizedParams = {
    amount: amount.Amount;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type AttestationReceipt = _AttestationReceipt<GatewayTransfer.Protocol>;
type TransferReceipt<SC extends Chain = Chain, DC extends Chain = Chain> = _TransferReceipt<
  AttestationReceipt,
  SC,
  DC
>;

type Op = ManualGatewayRoute.Options;
type Vp = ManualGatewayRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type QR = QuoteResult<Op, Vp>;
type Q = Quote<Op, Vp>;
type R = TransferReceipt;

export class ManualGatewayRoute<N extends Network>
  extends ManualRoute<N, Op, Vp, R>
  implements StaticRouteMethods<typeof ManualGatewayRoute>
{
  static meta = {
    name: "ManualGateway",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }

  static supportedChains(network: Network): Chain[] {
    return GatewayTransfer.supportedChains(network);
  }

  static async supportedSourceTokens(fromChain: ChainContext<Network>): Promise<TokenId[]> {
    return await GatewayTransfer.supportedSourceTokens(fromChain);
  }

  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    return await GatewayTransfer.supportedDestinationTokens(sourceToken, fromChain, toChain);
  }

  static isProtocolSupported<N extends Network>(chain: ChainContext<N>): boolean {
    return GatewayTransfer.isProtocolSupported(chain);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getDefaultOptions(): Op {
    return { payload: undefined };
  }

  async validate(params: Tp): Promise<Vr> {
    const validatedParams: Vp = {
      amount: params.amount,
      normalizedParams: { amount: amount.parse(params.amount, this.request.source.decimals) },
      options: { payload: params.options?.payload },
    };
    return { valid: true, params: validatedParams };
  }

  async quote(params: Vp): Promise<QR> {
    try {
      return this.request.displayQuote(
        await GatewayTransfer.quoteTransfer(this.wh, this.request.fromChain, this.request.toChain, {
          token: this.request.source.id,
          amount: amount.units(params.normalizedParams.amount),
          ...params.options,
        }),
        params,
      );
    } catch (e) {
      return {
        success: false,
        error: e as Error,
      };
    }
  }

  async initiate(signer: Signer, quote: Q, to: ChainAddress): Promise<R> {
    const transfer = await GatewayTransfer.destinationOverrides(
      this.request.fromChain,
      this.request.toChain,
      this.wh.getChain(GatewayTransfer.chain),
      this.toTransferDetails(
        quote.params,
        Wormhole.chainAddress(signer.chain(), signer.address()),
        to,
      ),
    );
    const txids = await GatewayTransfer.transfer<N>(
      this.wh,
      this.request.fromChain,
      transfer,
      signer,
    );
    return {
      from: transfer.from.chain,
      to: transfer.to.chain,
      state: TransferState.SourceInitiated,
      originTxs: txids,
    } satisfies SourceInitiatedTransferReceipt;
  }

  public override async *track(receipt: R, timeout?: number) {
    //yield* GatewayTransfer.track(
    //  this.wh,
    //  receipt,
    //  timeout,
    //  this.request.fromChain,
    //  this.request.toChain,
    //);
    throw new Error("Not implemented");
  }

  async complete(signer: Signer, receipt: R): Promise<R> {
    throw new Error("Not implemented");
    //if (!isAttested(receipt))
    //  throw new Error("The source must be finalized in order to complete the transfer");
    //const dstTxIds = await GatewayTransfer.redeem<N>(
    //  this.request.toChain,
    //  // TODO: the attestation should be a VAA<"TokenBridge:Transfer"> | VAA<"TokenBridge:TransferWithPayload">
    //  // @ts-ignore
    //  receipt.attestation.attestation as TokenTransfer.VAA,
    //  signer,
    //);
    //return {
    //  ...receipt,
    //  state: TransferState.DestinationInitiated,
    //  destinationTxs: dstTxIds,
    //};
  }

  private toTransferDetails(
    params: Vp,
    from: ChainAddress,
    to: ChainAddress,
  ): GatewayTransferDetails {
    return {
      from,
      to,
      token: this.request.source.id,
      amount: amount.units(params.normalizedParams.amount),
      ...params.options,
    };
  }
}
