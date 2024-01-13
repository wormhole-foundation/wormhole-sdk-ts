import { Network, Platform } from "@wormhole-foundation/sdk-base";
import {
  ChainContext,
  Signer,
  TokenTransferDetails,
  TransactionId,
  isSameToken,
  isTokenId,
} from "@wormhole-foundation/sdk-definitions";
import { TokenTransfer, TokenTransferVAA } from "../../protocols/tokenTransfer";
import { Wormhole } from "../../wormhole";
import { TransferReceipt, TransferState, isAttested } from "../../wormholeTransfer";
import { ManualRoute, RouteTransferRequest, ValidationResult } from "../route";

export namespace TokenBridgeRoute {
  export type Options = {
    payload?: Uint8Array;
  };
}

export class TokenBridgeRoute<N extends Network> extends ManualRoute<N, TokenBridgeRoute.Options> {
  fromChain: ChainContext<N, Platform>;
  toChain: ChainContext<N, Platform>;

  constructor(wh: Wormhole<N>, request: RouteTransferRequest) {
    super(wh, request);
    this.fromChain = this.wh.getChain(this.request.from.chain);
    this.toChain = this.wh.getChain(this.request.to.chain);
  }

  isSupported(): boolean {
    // No transfers to same chain
    if (this.request.from.chain === this.request.to.chain) return false;

    // No transfers to unsupported chains
    if (!this.fromChain.supportsTokenBridge()) return false;
    if (!this.toChain.supportsTokenBridge()) return false;

    return true;
  }

  async validate(options: TokenBridgeRoute.Options): Promise<ValidationResult<Error>> {
    try {
      // If the destination token was set, and its different than what
      // we'd get from a token bridge transfer, then this route is not supported
      if (this.request.destination) {
        if (this.request.destination === "native")
          throw new Error("Cannot convert to native token");

        const destToken = await TokenTransfer.lookupDestinationToken(
          this.fromChain,
          this.toChain,
          this.request.source,
        );
        if (
          isTokenId(this.request.destination) &&
          !isSameToken(destToken, this.request.destination)
        )
          throw new Error("Cannot convert to a different token");
      }

      const transfer = this.toTransferDetails(options);
      TokenTransfer.validateTransferDetails(this.wh, transfer);
      return { valid: true };
    } catch (e) {
      return { valid: false, error: e as Error };
    }
  }

  async quote(options: TokenBridgeRoute.Options) {
    return await TokenTransfer.quoteTransfer(
      this.fromChain,
      this.toChain,
      this.toTransferDetails(options),
    );
  }

  getDefaultOptions(): TokenBridgeRoute.Options {
    return { payload: undefined };
  }

  async initiate(
    signer: Signer,
    options: TokenBridgeRoute.Options,
  ): Promise<TransferReceipt<"TokenBridge">> {
    const transfer = this.toTransferDetails(options);
    const txids = await TokenTransfer.transfer<N>(this.fromChain, transfer, signer);
    const msg = await TokenTransfer.getTransferMessage(
      this.fromChain,
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
      this.toChain,
      // todo: ew?
      receipt.attestation.attestation as TokenTransferVAA,
      signer,
    );
  }

  public override async *track(receipt: TransferReceipt<"TokenBridge">, timeout?: number) {
    yield* TokenTransfer.track(this.wh, receipt, timeout, this.fromChain, this.toChain);
  }

  private toTransferDetails(options: TokenBridgeRoute.Options): TokenTransferDetails {
    return {
      token: this.request.source,
      amount: this.request.amount,
      from: this.request.from,
      to: this.request.to,
      ...options,
    };
  }
}
