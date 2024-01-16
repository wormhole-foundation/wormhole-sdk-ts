import { Network } from "@wormhole-foundation/sdk-base";
import {
  Signer,
  TokenTransferDetails,
  isSameToken,
  isTokenId,
} from "@wormhole-foundation/sdk-definitions";
import { TokenTransfer } from "../../protocols/tokenTransfer";
import { TransferReceipt, TransferState } from "../../wormholeTransfer";
import { AutomaticRoute, TransferParams, ValidationResult } from "../route";

export namespace AutomaticTokenBridgeRoute {
  export type Options = {
    // Expressed in percentage terms
    // e.g. 1.0 = 100%
    nativeGas: number;
  };
}

type Op = AutomaticTokenBridgeRoute.Options;
export class AutomaticTokenBridgeRoute<N extends Network> extends AutomaticRoute<N, Op> {
  NATIVE_GAS_DROPOFF_SUPPORTED = true;

  async isSupported(): Promise<boolean> {
    // No transfers to same chain
    if (this.request.fromChain.chain === this.request.toChain.chain) return false;

    // No transfers to unsupported chains
    if (!this.request.fromChain.supportsAutomaticTokenBridge()) return false;
    if (!this.request.toChain.supportsAutomaticTokenBridge()) return false;

    // Ensure source and destination tokens are equivalent, if destination is set
    const { source, destination } = this.request;
    if (destination && isTokenId(destination.id)) {
      // If destination token was provided, check that it's the equivalent one for the source token
      let equivalentToken = await TokenTransfer.lookupDestinationToken(
        this.request.fromChain,
        this.request.toChain,
        source.id,
      );

      if (!isSameToken(equivalentToken, destination.id)) {
        return false;
      }
    }

    return true;
  }

  static getDefaultOptions(): Op {
    return { nativeGas: 0.0 };
  }

  async isAvailable(): Promise<boolean> {
    const atb = await this.request.fromChain.getAutomaticTokenBridge();

    if (isTokenId(this.request.source.id))
      return await atb.isRegisteredToken(this.request.source.id.address);

    return true;
  }

  async validate(params: TransferParams<Op>): Promise<ValidationResult<Op>> {
    let nativeGas = params.options?.nativeGas ?? 0.0;

    try {
      const { destination } = this.request;
      if (destination && !isTokenId(destination.id)) {
        if (nativeGas === 0.0) {
          nativeGas = 1.0;
        }
      }

      if (nativeGas > 1.0 || nativeGas < 0.0) {
        throw new Error("Native gas must be between 0.0 and 1.0 (0% and 100%)");
      }

      params.options = { nativeGas };

      return { valid: true, params };
    } catch (e) {
      return { valid: false, params, error: e as Error };
    }
  }

  async quote(params: TransferParams<Op>) {
    return await TokenTransfer.quoteTransfer(
      this.request.fromChain,
      this.request.toChain,
      await this.toTransferDetails(params),
    );
  }

  async initiate(
    signer: Signer,
    params: TransferParams<Op>,
  ): Promise<TransferReceipt<"AutomaticTokenBridge">> {
    const transfer = await this.toTransferDetails(params);
    const txids = await TokenTransfer.transfer<N>(this.request.fromChain, transfer, signer);
    const msg = await TokenTransfer.getTransferMessage(
      this.request.fromChain,
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
    yield* TokenTransfer.track(
      this.wh,
      receipt,
      timeout,
      this.request.fromChain,
      this.request.toChain,
    );
  }

  private async toTransferDetails(params: TransferParams<Op>): Promise<TokenTransferDetails> {
    const { source, from, to } = this.request;
    const amount = this.request.normalizeAmount(params.amount);
    let options = params.options ?? AutomaticTokenBridgeRoute.getDefaultOptions();

    // Determine nativeGas
    let nativeGas = 0n;

    // Calculate nativeGas in base units if options.nativeGas isn't 0
    if (options && options.nativeGas > 0) {
      const atb = await this.request.fromChain.getAutomaticTokenBridge();

      const inputToken = source.id === "native" ? source.nativeWrapped! : source.id;
      const fee = await atb.getRelayerFee(from.address, to, inputToken.address);

      // Scaling up and down with 100 means we don't support fractional percentages
      const percScale = 100;
      // Scale percentage up to a whole number bigint
      // 100n = 100% etc
      const nativeGasPercentage = BigInt(Math.round(options.nativeGas * percScale));
      const transferableAmount = amount - fee;
      nativeGas = (transferableAmount * nativeGasPercentage) / BigInt(percScale);
    }

    const transfer = {
      from,
      to,
      amount,
      token: source.id,
      automatic: true,
      nativeGas,
    };

    return transfer;
  }
}
