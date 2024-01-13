import { Network } from "@wormhole-foundation/sdk-base";
import { Platform } from "@wormhole-foundation/sdk-base/src";
import {
  ChainContext,
  Signer,
  TokenTransferDetails,
  isSameToken,
  isTokenId,
} from "@wormhole-foundation/sdk-definitions";
import { TokenTransfer } from "../../protocols/tokenTransfer";
import { Wormhole } from "../../wormhole";
import { TransferReceipt, TransferState } from "../../wormholeTransfer";
import { AutomaticRoute, RouteTransferRequest, ValidationResult } from "../route";

export namespace AutomaticTokenBridgeRoute {
  export type Options = {
    nativeGas?: bigint;
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

  isSupported(): boolean {
    // No transfers to same chain
    if (this.request.from.chain === this.request.to.chain) return false;

    // No transfers to unsupported chains
    if (!this.fromChain.supportsAutomaticTokenBridge()) return false;
    if (!this.toChain.supportsAutomaticTokenBridge()) return false;

    return true;
  }

  async isAvailable(): Promise<boolean> {
    const atb = await this.fromChain.getAutomaticTokenBridge();

    if (isTokenId(this.request.source))
      return await atb.isRegisteredToken(this.request.source.address);

    return true;
  }

  getDefaultOptions(): AutomaticTokenBridgeRoute.Options {
    return { nativeGas: 0n };
  }

  async validate(options: AutomaticTokenBridgeRoute.Options): Promise<ValidationResult<Error>> {
    try {
      // If the destination set and is set to native, then the native gas dropoff feature
      // can be used.

      const { source, amount, destination, to, from } = this.request;
      const nativeGas = options.nativeGas ?? 0n;

      const transferableAmount = amount - nativeGas;
      if (transferableAmount < 0n) throw new Error("Native gas cannot be greater than amount");

      const tokenAddress = isTokenId(source) ? source.address : source;

      const atb = await this.fromChain.getAutomaticTokenBridge();
      const fee = await atb.getRelayerFee(from.address, to, tokenAddress);
      if (!(transferableAmount >= fee))
        throw new Error(
          `Amount - native gas requested must be greater than fee:  ${transferableAmount} >= ${fee})`,
        );

      if (destination) {
        if (destination === "native") {
          // if the full amount is consumed, then the destination token is not needed
          const fullyConsumed = transferableAmount - fee === 0n;
          if (!fullyConsumed)
            // But if they also specified nativeGasDropoff, and its not exactly the same as the amount
            // somebody is confused
            throw new Error(
              "Overspecified: either do not specify destination asset or do not specify native gas dropoff",
            );
        } else {
          const destToken = await TokenTransfer.lookupDestinationToken(
            this.fromChain,
            this.toChain,
            this.request.source,
          );
          if (
            isTokenId(this.request.destination) &&
            !isSameToken(destToken, this.request.destination)
          )
            throw new Error("Cannot convert between these tokens");
        }
      }

      const transfer = this.toTransferDetails(options);
      TokenTransfer.validateTransferDetails(this.wh, transfer);

      return { valid: true };
    } catch (e) {
      return { valid: false, error: e as Error };
    }
  }

  async quote(options: AutomaticTokenBridgeRoute.Options) {
    return await TokenTransfer.quoteTransfer(
      this.fromChain,
      this.toChain,
      this.toTransferDetails(options),
    );
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

  public override async *track(receipt: TransferReceipt<"AutomaticTokenBridge">, timeout?: number) {
    yield* TokenTransfer.track(this.wh, receipt, timeout, this.fromChain, this.toChain);
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
    return transfer;
  }
}
