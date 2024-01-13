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
import { TransferReceipt, TransferState, isAttested } from "../../wormholeTransfer";
import { ManualRoute, ValidationResult } from "../route";

export namespace TokenBridgeRoute {
  export type Options = {
    payload?: Uint8Array;
  };
}

type Op = TokenBridgeRoute.Options;
export class TokenBridgeRoute<N extends Network> extends ManualRoute<N, Op> {
  static isSupported<N extends Network>(
    fromChain: ChainContext<N, Platform>,
    toChain: ChainContext<N, Platform>,
  ): boolean {
    // No transfers to same chain
    if (fromChain.chain === toChain.chain) return false;

    // No transfers to unsupported chains
    if (!fromChain.supportsTokenBridge()) return false;
    if (!toChain.supportsTokenBridge()) return false;

    return true;
  }

  static getDefaultOptions(): TokenBridgeRoute.Options {
    return { payload: undefined };
  }

  async validate(options?: Op): Promise<ValidationResult<Op>> {
    options = options ?? TokenBridgeRoute.getDefaultOptions();
    try {
      const quote = await this.quote(options);
      // If the destination token was set, and its different than what
      // we'd get from a token bridge transfer, then this route is not supported
      if (this.request.destination) {
        // TODO: yes we can, if the origin is the wrapped native token
        if (this.request.destination === "native")
          throw new Error("Cannot convert to native token");

        if (
          isTokenId(this.request.destination) &&
          !isSameToken(quote.destinationToken.token, this.request.destination)
        )
          throw new Error("Cannot convert to a different token");
      }
      return { valid: true, quote, options };
    } catch (e) {
      return { valid: false, options, error: e as Error };
    }
  }

  async quote(options: TokenBridgeRoute.Options) {
    return await TokenTransfer.quoteTransfer(
      this.fromChain,
      this.toChain,
      this.toTransferDetails(options),
    );
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
