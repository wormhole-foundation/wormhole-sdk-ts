import { AutomaticRoute, type StaticRouteMethods } from "../route.js";
import { type Chain, type Network } from "@wormhole-foundation/sdk-base";
import type {
  ChainAddress,
  ChainContext,
  GatewayTransferDetails,
  Signer,
  TokenId,
} from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../../wormhole.js";
import type {
  Quote,
  QuoteResult,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types.js";
import { GatewayTransfer } from "../../protocols/index.js";
import { amount } from "@wormhole-foundation/sdk-base";
import {
  TransferState,
  type SourceInitiatedTransferReceipt,
  type TransferReceipt,
} from "../../types.js";

export namespace AutomaticGatewayRoute {
  export type Options = {};

  export type NormalizedParams = {
    amount: amount.Amount;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = AutomaticGatewayRoute.Options;
type Vp = AutomaticGatewayRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type QR = QuoteResult<Op, Vp>;
type Q = Quote<Op, Vp>;
type R = TransferReceipt<GatewayTransfer.AttestationReceipt>;

export class AutomaticGatewayRoute<N extends Network>
  extends AutomaticRoute<N, Op, Vp, R>
  implements StaticRouteMethods<typeof AutomaticGatewayRoute>
{
  NATIVE_GAS_DROPOFF_SUPPORTED = false;

  static meta = {
    name: "AutomaticGateway",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }

  static supportedChains(network: Network): Chain[] {
    return GatewayTransfer.supportedChains(network);
  }

  static async supportedSourceTokens(fromChain: ChainContext<Network>): Promise<TokenId[]> {
    return GatewayTransfer.supportedSourceTokens(fromChain);
  }

  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    return GatewayTransfer.supportedDestinationTokens(sourceToken, fromChain, toChain);
  }

  static isProtocolSupported<N extends Network>(chain: ChainContext<N>): boolean {
    return GatewayTransfer.isProtocolSupported(chain);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getDefaultOptions(): Op {
    return {};
  }

  async validate(params: Tp): Promise<Vr> {
    const validatedParams: Vp = {
      amount: params.amount,
      normalizedParams: { amount: amount.parse(params.amount, this.request.source.decimals) },
      options: {},
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
    yield* GatewayTransfer.track(
      this.wh,
      receipt,
      timeout,
      this.request.fromChain,
      this.request.toChain,
    );
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
