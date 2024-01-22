import { Chain, Network, circle } from "@wormhole-foundation/sdk-base";
import {
  CircleBridge,
  CircleTransferDetails,
  Signer,
  TransactionId,
} from "@wormhole-foundation/sdk-definitions";
import { signSendWait } from "../../common";
import { CircleAttestationReceipt, CircleTransfer } from "../../protocols/cctpTransfer";
import { TransferQuote, TransferReceipt, TransferState, isAttested } from "../../types";
import { ManualRoute } from "../route";
import { TransferParams, ValidatedTransferParams, ValidationResult } from "../types";

export namespace CCTPRoute {
  export type Options = {
    payload?: Uint8Array;
  };

  export type NormalizedParams = {
    amount: bigint;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = CCTPRoute.Options;
type Vp = CCTPRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type Q = TransferQuote;
type R = TransferReceipt<CircleAttestationReceipt>;

export class CCTPRoute<N extends Network> extends ManualRoute<N, Op, R, Q> {
  getDefaultOptions(): Op {
    return {
      payload: undefined,
    };
  }

  async isSupported(): Promise<boolean> {
    if (
      !this.request.toChain.supportsCircleBridge() ||
      !this.request.fromChain.supportsCircleBridge()
    ) {
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

  async validate(params: Tp): Promise<Vr> {
    const amount = this.request.normalizeAmount(params.amount);

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
      options: params.options ?? this.getDefaultOptions(),
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

  async initiate(signer: Signer, params: Vp): Promise<R> {
    let transfer = this.toTransferDetails(params);
    let txids = await CircleTransfer.transfer<N>(this.request.fromChain, transfer, signer);
    const msg = await CircleTransfer.getTransferMessage(
      this.request.fromChain,
      txids[txids.length - 1]!.txid,
    );

    return {
      from: transfer.from.chain,
      to: transfer.to.chain,
      state: TransferState.SourceFinalized,
      originTxs: txids,
      attestation: { id: msg.id },
    };
  }

  async complete(signer: Signer, receipt: R): Promise<TransactionId[]> {
    if (!isAttested(receipt))
      throw new Error("The source must be finalized in order to complete the transfer");

    const { id, attestation: att } = receipt.attestation;
    if (CircleBridge.isCircleAttestation(att)) {
      const { message, attestation } = att;
      if (!attestation) throw new Error(`No Circle attestation for ${id}`);

      let cb = await this.request.toChain.getCircleBridge();
      let xfer = cb.redeem(this.request.to.address, message, attestation);
      return await signSendWait<N, Chain>(this.request.toChain, xfer, signer);
    } else {
      //
      return [];
    }
  }

  public override async *track(receipt: R, timeout?: number) {
    yield* CircleTransfer.track(
      this.wh,
      receipt,
      timeout,
      this.request.fromChain,
      this.request.toChain,
    );
  }

  private toTransferDetails(params: Vp): CircleTransferDetails {
    return {
      from: this.request.from,
      to: this.request.to,
      amount: params.normalizedParams.amount,
      automatic: false,
      ...params.options,
    };
  }
}
