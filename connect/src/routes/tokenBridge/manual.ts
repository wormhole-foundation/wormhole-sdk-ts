import { Network } from "@wormhole-foundation/sdk-base";
import {
  Signer,
  TokenTransferDetails,
  TransactionId,
  isSameToken,
  isTokenId,
} from "@wormhole-foundation/sdk-definitions";
import { TokenTransfer, TokenTransferVAA } from "../../protocols/tokenTransfer";
import { TransferReceipt, TransferState, isAttested } from "../../wormholeTransfer";
import { ManualRoute, TransferParams, ValidatedTransferParams, ValidationResult } from "../route";

export namespace TokenBridgeRoute {
  export type Options = {
    payload?: Uint8Array;
  };

  export type NormalizedParams = {
    amount: bigint;
  };
}

type Op = TokenBridgeRoute.Options;
type Np = TokenBridgeRoute.NormalizedParams;

type Tp = TransferParams<Op, Np>;
type Vtp = ValidatedTransferParams<Op, Np>;
type Vr = ValidationResult<Op, Np>;

export class TokenBridgeRoute<N extends Network> extends ManualRoute<N, Op, Np> {
  static getDefaultOptions(): TokenBridgeRoute.Options {
    return { payload: undefined };
  }

  async isSupported(): Promise<boolean> {
    // No transfers to same chain
    if (this.request.fromChain.chain === this.request.toChain.chain) return false;

    // No transfers to unsupported chains
    if (!this.request.fromChain.supportsTokenBridge()) return false;
    if (!this.request.toChain.supportsTokenBridge()) return false;

    // Ensure the destination token is the equivalent wrapped token
    let { source, destination } = this.request;
    if (destination && isTokenId(destination.id)) {
      let equivalentToken = await TokenTransfer.lookupDestinationToken(
        this.request.fromChain,
        this.request.toChain,
        source.id,
      );

      if (!isSameToken(equivalentToken, destination.id)) {
        return false;
      }
    } else if (destination && destination.id === "native") {
      return false;
    }

    return true;
  }

  async validate(params: Tp): Promise<Vr> {
    const amt = this.request.normalizeAmount(params.amount);
    if (amt <= 0n) {
      return { valid: false, params, error: new Error("Amount has to be positive") };
    }

    const validatedParams = {
      amount: params.amount,
      normalizedParams: { amount: amt },
      options: {},
    } satisfies ValidatedTransferParams<Op, Np>;

    return { valid: true, params: validatedParams };
  }

  async quote(params: Vtp) {
    return await TokenTransfer.quoteTransfer(
      this.request.fromChain,
      this.request.toChain,
      this.toTransferDetails(params),
    );
  }

  async initiate(signer: Signer, params: Vtp): Promise<TransferReceipt<"TokenBridge">> {
    const transfer = this.toTransferDetails(params);
    const txids = await TokenTransfer.transfer<N>(this.request.fromChain, transfer, signer);
    const msg = await TokenTransfer.getTransferMessage(
      this.request.fromChain,
      txids[txids.length - 1]!.txid,
    );

    return {
      protocol: "TokenBridge",
      from: transfer.from.chain,
      to: transfer.to.chain,
      state: TransferState.SourceFinalized,
      request: transfer,
      originTxs: txids,
      attestation: { id: msg },
    };
  }

  async complete(
    signer: Signer,
    receipt: TransferReceipt<"TokenBridge">,
  ): Promise<TransactionId[]> {
    if (!isAttested(receipt))
      throw new Error("The source must be finalized in order to complete the transfer");
    return await TokenTransfer.redeem<N>(
      this.request.toChain,
      // todo: ew?
      receipt.attestation.attestation as TokenTransferVAA,
      signer,
    );
  }

  public override async *track(receipt: TransferReceipt<"TokenBridge">, timeout?: number) {
    yield* TokenTransfer.track(
      this.wh,
      receipt,
      timeout,
      this.request.fromChain,
      this.request.toChain,
    );
  }

  private toTransferDetails(params: Vtp): TokenTransferDetails {
    return {
      token: this.request.source.id,
      from: this.request.from,
      to: this.request.to,
      amount: params.normalizedParams.amount,
      ...params.options,
    };
  }
}
