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
    if (this.fromChain.chain === this.toChain.chain) return false;

    // No transfers to unsupported chains
    if (!this.fromChain.supportsTokenBridge()) return false;
    if (!this.toChain.supportsTokenBridge()) return false;

    // Ensure the destination token is the equivalent wrapped token
    let { source, destination } = this.request;
    if (destination && isTokenId(destination)) {
      let equivalentToken = await TokenTransfer.lookupDestinationToken(
        this.fromChain,
        this.toChain,
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
      this.fromChain,
      this.toChain,
      await this.toTransferDetails(params),
    );
  }

  async initiate(
    signer: Signer,
    params: TransferParams<Op>,
  ): Promise<TransferReceipt<"TokenBridge">> {
    const transfer = await this.toTransferDetails(params);
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

  private async stringToBigInt(amount: string = "0"): Promise<bigint> {
    const { from } = this.request;
    let decimals = isTokenId(this.request.source)
      ? await this.wh.getDecimals(from.chain, from.address)
      : BigInt(this.fromChain.config.nativeTokenDecimals);

    return normalizeAmount(amount, decimals);
  }

  private async toTransferDetails(params: TransferParams<Op>): Promise<TokenTransferDetails> {
    let amount = await this.stringToBigInt(params.amount);

    return {
      token: this.request.source,
      from: this.request.from,
      to: this.request.to,
      amount,
      ...params.options,
    };
  }
}
