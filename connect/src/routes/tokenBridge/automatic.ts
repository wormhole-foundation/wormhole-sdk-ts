import { Network, normalizeAmount } from "@wormhole-foundation/sdk-base";
import {
  Signer,
  TokenTransferDetails,
  isSameToken,
  isTokenId,
} from "@wormhole-foundation/sdk-definitions";
import { TokenTransfer } from "../../protocols/tokenTransfer";
import { TransferReceipt, TransferState } from "../../wormholeTransfer";
import { AutomaticRoute, ValidationResult, TransferParams } from "../route";

export namespace AutomaticTokenBridgeRoute {
  export type Options = {
    // Expressed in percentage terms
    // 1.0 = 100%
    nativeGas: number;
  };
}

type Op = AutomaticTokenBridgeRoute.Options;
export class AutomaticTokenBridgeRoute<N extends Network> extends AutomaticRoute<N, Op> {
  NATIVE_GAS_DROPOFF_SUPPORTED = true;

  async isSupported(): Promise<boolean> {
    // No transfers to same chain
    if (this.configs.from.context.chain === this.configs.to.context.chain) return false;

    // No transfers to unsupported chains
    if (!this.configs.from.context.supportsAutomaticTokenBridge()) return false;
    if (!this.configs.to.context.supportsAutomaticTokenBridge()) return false;

    // Ensure source and destination tokens are equivalent, if destination is set
    const { source, destination } = this.request;
    if (destination && isTokenId(destination)) {
      // If destination token was provided, check that it's the equivalent one for the source token
      let equivalentToken = await TokenTransfer.lookupDestinationToken(
        this.configs.from.context,
        this.configs.to.context,
        source,
      );

      if (!isSameToken(equivalentToken, destination)) {
        return false;
      }
    }

    return true;
  }
  static getDefaultOptions(): Op {
    return { nativeGas: 0.0 };
  }

  async isAvailable(): Promise<boolean> {
    const atb = await this.configs.from.context.getAutomaticTokenBridge();

    if (isTokenId(this.request.source))
      return await atb.isRegisteredToken(this.request.source.address);

    return true;
  }

  async validate(params: TransferParams<Op>): Promise<ValidationResult<Op>> {
    let nativeGas = params.options?.nativeGas ?? 0.0;

    try {
      const { destination } = this.request;
      if (destination && !isTokenId(destination)) {
        // considered unset for our purposes
        // they've asked for native gas dropoff implicitly
        // max out native gas. This value may be negative but we check that later
        if (nativeGas === 0.0) {
          nativeGas = 1.0;
        }
        // strict equality from here,
        //  if it came in set
        //  and they specified native dest token
        //  then nativeGas must be exactly the same as amount - fee
      }

      if (nativeGas > 1.0 || nativeGas < 0.0) {
        throw new Error("Native gas must be between 0% and 100%");
      }

      params.options = { nativeGas };

      return {
        valid: true,
        params,
      };
    } catch (e) {
      return { valid: false, params, error: e as Error };
    }
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
  ): Promise<TransferReceipt<"AutomaticTokenBridge">> {
    const transfer = await this.toTransferDetails(params);
    const txids = await TokenTransfer.transfer<N>(this.configs.from.context, transfer, signer);
    const msg = await TokenTransfer.getTransferMessage(
      this.configs.from.context,
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
      this.configs.from.context,
      this.configs.to.context,
    );
  }

  private async toTransferDetails(params: TransferParams<Op>): Promise<TokenTransferDetails> {
    const { source, from, to } = this.request;
    const amount = normalizeAmount(params.amount, this.configs.from.decimals);
    let options = params.options ?? AutomaticTokenBridgeRoute.getDefaultOptions();

    // Determine nativeGas
    let nativeGas = 0n;

    // Calculate nativeGas in base units if options.nativeGas isn't 0
    if (options && options.nativeGas > 0) {
      const atb = await this.configs.from.context.getAutomaticTokenBridge();
      const fee = await atb.getRelayerFee(
        this.request.from.address,
        this.request.to,
        this.request.from.address,
      );

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
      token: source,
      automatic: true,
      nativeGas,
    };
    return transfer;
  }
}
