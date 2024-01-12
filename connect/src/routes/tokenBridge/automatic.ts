import { Network } from "@wormhole-foundation/sdk-base";
import {
  Signer,
  TokenTransferDetails,
  isSameToken,
  isTokenId,
} from "@wormhole-foundation/sdk-definitions";
import { TokenTransfer } from "../../protocols/tokenTransfer";
import { TransferReceipt, TransferState } from "../../wormholeTransfer";
import { AutomaticRoute, ValidationResult } from "../route";

export namespace AutomaticTokenBridgeRoute {
  export type Options = {
    nativeGasDropoff?: bigint;
  };
}

export class AutomaticTokenBridgeRoute<N extends Network> extends AutomaticRoute<
  N,
  AutomaticTokenBridgeRoute.Options
> {
  NATIVE_GAS_DROPOFF_SUPPORTED = true;

  async isSupported(): Promise<boolean> {
    // No transfers to same chain
    if (this.request.from.chain === this.request.to.chain) return false;

    // No transfers to unsupported chains
    const fromChain = this.wh.getChain(this.request.from.chain);
    if (!fromChain.supportsAutomaticTokenBridge()) return false;

    const toChain = this.wh.getChain(this.request.to.chain);
    if (!toChain.supportsAutomaticTokenBridge()) return false;

    const atb = await fromChain.getAutomaticTokenBridge();
    if (isTokenId(this.request.source) && !atb.isRegisteredToken(this.request.source.address))
      return false;

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

  async isAvailable(): Promise<boolean> {
    // TODO
    return true;
  }

  getDefaultOptions(): AutomaticTokenBridgeRoute.Options {
    return { nativeGasDropoff: 0n };
  }

  async validate(options: AutomaticTokenBridgeRoute.Options): Promise<ValidationResult<Error>> {
    const transfer = this.toTransferDetails(options);
    try {
      await TokenTransfer.validateTransferDetails(this.wh, transfer);
      return { valid: true };
    } catch (e) {
      return { valid: false, error: e as Error };
    }
  }

  async initiate(
    signer: Signer,
    options: AutomaticTokenBridgeRoute.Options,
  ): Promise<TransferReceipt<"AutomaticTokenBridge">> {
    const fromChain = this.wh.getChain(this.request.from.chain);
    const transfer = this.toTransferDetails(options);
    const txids = await TokenTransfer.transfer<N>(fromChain, transfer, signer);
    const msg = await TokenTransfer.getTransferMessage(fromChain, txids[txids.length - 1]!.txid);
    return {
      protocol: "AutomaticTokenBridge",
      from: transfer.from.chain,
      to: transfer.to.chain,
      state: TransferState.SourceFinalized,
      request: transfer,
      originTxs: txids,
      attestation: { id: msg },
    };
  }

  async *track(
    receipt: TransferReceipt<"AutomaticTokenBridge">,
  ): AsyncGenerator<TransferReceipt<"AutomaticTokenBridge">> {
    return TokenTransfer.track(this.wh, receipt);
  }

  private toTransferDetails(options: AutomaticTokenBridgeRoute.Options): TokenTransferDetails {
    return {
      token: this.request.source,
      amount: this.request.amount,
      from: this.request.from,
      to: this.request.to,
      automatic: true,
      ...options,
    };
  }
}
