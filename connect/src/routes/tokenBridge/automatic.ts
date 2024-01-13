import { Network } from "@wormhole-foundation/sdk-base";
import {
  ChainContext,
  Signer,
  TokenTransferDetails,
  isSameToken,
  isTokenId,
} from "@wormhole-foundation/sdk-definitions";
import { TokenTransfer } from "../../protocols/tokenTransfer";
import { TransferReceipt, TransferState } from "../../wormholeTransfer";
import { AutomaticRoute, RouteTransferRequest, ValidationResult } from "../route";
import { Wormhole } from "../../wormhole";
import { Platform } from "@wormhole-foundation/sdk-base/src";

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
  fromChain: ChainContext<N, Platform>;
  toChain: ChainContext<N, Platform>;

  constructor(wh: Wormhole<N>, request: RouteTransferRequest) {
    super(wh, request);
    this.fromChain = this.wh.getChain(this.request.from.chain);
    this.toChain = this.wh.getChain(this.request.to.chain);
  }

  async isSupported(): Promise<boolean> {
    // No transfers to same chain
    if (this.request.from.chain === this.request.to.chain) return false;

    // No transfers to unsupported chains
    if (!this.fromChain.supportsAutomaticTokenBridge()) return false;

    const toChain = this.wh.getChain(this.request.to.chain);
    if (!toChain.supportsAutomaticTokenBridge()) return false;

    const atb = await this.fromChain.getAutomaticTokenBridge();
    if (isTokenId(this.request.source) && !atb.isRegisteredToken(this.request.source.address))
      return false;

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
    try {
      // If the destination token was set, and its different than what
      // we'd get from a token bridge transfer, then this route is not supported
      if (this.request.destination) {
        if (this.request.destination === "native") {
          if (!this.NATIVE_GAS_DROPOFF_SUPPORTED)
            throw new Error("Native gas dropoff not supported");

          if (options.nativeGasDropoff !== undefined) {
            throw new Error(
              "Overspecification, either do not specify destination asset or do not specify native gas dropoff",
            );
          }

          options.nativeGasDropoff = this.request.amount;
        }

        const destToken = await TokenTransfer.lookupDestinationToken(
          this.fromChain,
          this.toChain,
          this.request.source,
        );
        if (
          isTokenId(this.request.destination) &&
          !isSameToken(destToken, this.request.destination)
        )
          throw new Error(
            `Cannot convert to source to destination token: ${this.request.source} : ${destToken}`,
          );
      }

      const transfer = this.toTransferDetails(options);
      await TokenTransfer.validateTransferDetails(this.wh, transfer);

      return { valid: true };
    } catch (e) {
      return { valid: false, error: e as Error };
    }
  }

  async quote(options: AutomaticTokenBridgeRoute.Options) {
    const fromChain = this.wh.getChain(this.request.from.chain);
    const toChain = this.wh.getChain(this.request.to.chain);
    return await TokenTransfer.quoteTransfer(fromChain, toChain, this.toTransferDetails(options));
  }

  async initiate(
    signer: Signer,
    options: AutomaticTokenBridgeRoute.Options,
  ): Promise<TransferReceipt<"AutomaticTokenBridge">> {
    const transfer = this.toTransferDetails(options);
    const txids = await TokenTransfer.transfer<N>(this.fromChain, transfer, signer);
    const msg = await TokenTransfer.getTransferMessage(
      this.fromChain,
      txids[txids.length - 1]!.txid,
    );
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
    const { source, amount, from, to } = this.request;
    const transfer = {
      from,
      to,
      amount,
      token: source,
      automatic: true,
      ...options,
    };

    // The only way this is supported is if the source token is
    // wrapped e
    // with native gas dropoff
    // override native gas dropoff amount to the amount specified
    // in source tokens
    if (this.request.destination === "native") {
      transfer.nativeGasDropoff = amount;
    }

    return transfer;
  }
}
