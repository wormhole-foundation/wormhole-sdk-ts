import { Network } from "@wormhole-foundation/sdk-base";
import {
  Signer,
  TokenTransferDetails,
  TransactionId,
  isSameToken,
} from "@wormhole-foundation/sdk-definitions";
import { TokenTransfer } from "../../protocols/tokenTransfer";
import { TransferReceipt, TransferState, isSourceFinalized } from "../../wormholeTransfer";
import { ManualRoute, ValidationResult } from "../route";

export namespace TokenBridgeRoute {
  export type Options = {
    payload?: Uint8Array;
  };
}

export class TokenBridgeRoute<N extends Network> extends ManualRoute<N, TokenBridgeRoute.Options> {
  async isSupported(): Promise<boolean> {
    // No transfers to same chain
    if (this.request.from.chain === this.request.to.chain) return false;

    // No transfers to unsupported chains
    const fromChain = this.wh.getChain(this.request.from.chain);
    if (!fromChain.supportsTokenBridge()) return false;

    const toChain = this.wh.getChain(this.request.to.chain);
    if (!toChain.supportsTokenBridge()) return false;

    // If the destination token was set, and its different than what
    // we'd get from a token bridge transfer, then this route is not supported
    if (this.request.destination) {
      const destToken = await TokenTransfer.lookupDestinationToken(
        fromChain,
        toChain,
        this.request.source,
      );
      if (!isSameToken(destToken, this.request.destination)) return false;
    }

    return true;
  }

  async validate(options: TokenBridgeRoute.Options): Promise<ValidationResult<Error>> {
    const transfer = this.toTransferDetails(options);
    try {
      await TokenTransfer.validateTransferDetails(this.wh, transfer);
      return { valid: true };
    } catch (e) {
      return { valid: false, error: e as Error };
    }
  }

  getDefaultOptions(): TokenBridgeRoute.Options {
    return { payload: undefined };
  }

  async initiate(
    signer: Signer,
    options: TokenBridgeRoute.Options,
  ): Promise<TransferReceipt<"TokenBridge">> {
    const fromChain = this.wh.getChain(this.request.from.chain);
    const transfer = this.toTransferDetails(options);
    const txids = await TokenTransfer.transfer<N>(fromChain, transfer, signer);
    const msg = await TokenTransfer.getTransferMessage(fromChain, txids[txids.length - 1]!.txid);

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
    if (!isSourceFinalized(receipt))
      throw new Error("The source must be finalized in order to complete the transfer");

    const toChain = this.wh.getChain(this.request.to.chain);
    const vaa = await TokenTransfer.getTransferVaa(this.wh, receipt.attestation.id);
    return await TokenTransfer.redeem<N>(toChain, vaa, signer);
  }

  async *track(
    receipt: TransferReceipt<"TokenBridge">,
  ): AsyncGenerator<TransferReceipt<"TokenBridge">> {
    return TokenTransfer.track(this.wh, receipt);
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
