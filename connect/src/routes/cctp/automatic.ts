import { Signer, CircleTransferDetails, TransactionId } from "@wormhole-foundation/sdk-definitions";
import { AutomaticRoute, TransferParams, ValidatedTransferParams, ValidationResult } from "../route";
import { CircleTransfer, CircleTransferProtocol } from "../../protocols/cctpTransfer";
import { signSendWait } from "../../common";
import { Network, circle, normalizeAmount, Chain } from "@wormhole-foundation/sdk-base";
import {  TransferReceipt, TransferState, isAttested , TransferQuote} from "../../protocols/wormholeTransfer";

export namespace AutomaticCCTPRoute {
  export type Options = {
    // 0.0 - 1.0 percentage
    nativeGas?: number;
  };

  export type NormalizedParams = {
    amount: bigint;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = AutomaticCCTPRoute.Options;
type Vp = AutomaticCCTPRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;
type Q = TransferQuote;
type R = TransferReceipt<"AutomaticCircleBridge">;

export class AutomaticCCTPRoute<N extends Network> extends AutomaticRoute<N, Op, R, Q> {
  static getDefaultOptions(): Op {
    return {
      nativeGas: 0.0,
    };
  }

  async isSupported(): Promise<boolean> {
    if (!this.request.toChain.supportsCircleBridge() || !this.request.fromChain.supportsCircleBridge()) {
      return false;
    }

    if (!circle.usdcContract.get(this.wh.network, this.request.from.chain)) {
      return false;
    }
    if (!circle.usdcContract.get(this.wh.network, this.request.to.chain)) {
      return false;
    }

    return true;
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async validate(params: Tp): Promise<Vr> {
    const amount = normalizeAmount(params.amount, this.request.source.decimals);

    if (amount < 0n) {
      return {
        valid: false,
        params,
        error: new Error("Amount must be positive"),
      };
    }

    const validatedParams: Vp = {
      normalizedParams: {
        amount,
      },
      options: params.options ?? AutomaticCCTPRoute.getDefaultOptions(),
      ...params,
    };

    return { valid: true, params: validatedParams };
  }

  async quote(params: Vp) {
    return await CircleTransfer.quoteTransfer(
      this.request.fromChain,
      this.request.toChain,
      this.toTransferDetails(params),
    );
  }

  private toTransferDetails(params: Vp): CircleTransferDetails {
    return {
      from: this.request.from,
      to: this.request.to,
      amount: params.normalizedParams.amount,
      automatic: false,
    };
  }

  async initiate(signer: Signer, params: Vp): Promise<TransferReceipt<CircleTransferProtocol>> {
    let transfer = this.toTransferDetails(params);
    let txids = await CircleTransfer.transfer(this.request.fromChain, transfer, signer);
    const msg = await CircleTransfer.getTransferMessage(
      this.request.fromChain,
      txids[txids.length - 1]!.txid,
    );

    return {
      from: transfer.from.chain,
      to: transfer.to.chain,
      state: TransferState.SourceFinalized,
      request: transfer,
      originTxs: txids,
      attestation: { id: msg },
    };
  }

  public override async *track(receipt: TransferReceipt<"AutomaticCircleBridge">, timeout?: number) {
    yield* CircleTransfer.track(
      this.wh,
      receipt,
      timeout,
      this.request.fromChain,
      this.request.toChain,
    );
  }
}

