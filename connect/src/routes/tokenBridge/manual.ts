import { Network, normalizeAmount } from "@wormhole-foundation/sdk-base";
import {
  Signer,
  TokenTransferDetails,
  TransactionId,
  isSameToken,
  isTokenId,
} from "@wormhole-foundation/sdk-definitions";
import { TokenTransfer, TokenTransferVAA } from "../../protocols/tokenTransfer";
import { TransferReceipt, TransferState, isAttested } from "../../wormholeTransfer";
import { ManualRoute, ValidationResult, TransferParams } from "../route";

export namespace TokenBridgeRoute {
  export type Options = {
    payload?: Uint8Array;
  };
}

type Op = TokenBridgeRoute.Options;
export class TokenBridgeRoute<N extends Network> extends ManualRoute<N, Op> {
  static getDefaultOptions(): TokenBridgeRoute.Options {
    return { payload: undefined };
  }

  async isSupported(): Promise<boolean> {
    // No transfers to same chain
    if (this.configs.from.context.chain === this.configs.to.context.chain) return false;

    // No transfers to unsupported chains
    if (!this.configs.from.context.supportsTokenBridge()) return false;
    if (!this.configs.to.context.supportsTokenBridge()) return false;

    // Ensure the destination token is the equivalent wrapped token
    let { source, destination } = this.request;
    if (destination && isTokenId(destination)) {
      let equivalentToken = await TokenTransfer.lookupDestinationToken(
        this.configs.from.context,
        this.configs.to.context,
        source,
      );

      if (!isSameToken(equivalentToken, destination)) {
        return false;
      }
    } else if (destination === "native") {
      return false;
    }

    return true;
  }

  async validate(params: TransferParams<Op>): Promise<ValidationResult<Op>> {
    if (BigInt(params.amount) <= 0n) {
      return { valid: false, params, error: new Error("Amount has to be positive") };
    }

    return { valid: true, params };
  }

  async quote(params: TransferParams<Op>) {
    return await TokenTransfer.quoteTransfer(
      this.configs.from.context,
      this.configs.to.context,
      await this.toTransferDetails(params),
    );
  }

  async initiate(
    signer: Signer,
    params: TransferParams<Op>,
  ): Promise<TransferReceipt<"TokenBridge">> {
    const transfer = await this.toTransferDetails(params);
    const txids = await TokenTransfer.transfer<N>(this.configs.from.context, transfer, signer);
    const msg = await TokenTransfer.getTransferMessage(
      this.configs.from.context,
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
      this.configs.to.context,
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
      this.configs.from.context,
      this.configs.to.context,
    );
  }

  private async toTransferDetails(params: TransferParams<Op>): Promise<TokenTransferDetails> {
    const amount = normalizeAmount(params.amount, this.configs.from.decimals);

    return {
      token: this.request.source,
      from: this.request.from,
      to: this.request.to,
      amount,
      ...params.options,
    };
  }
}
