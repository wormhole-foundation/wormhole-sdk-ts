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
  export type InputOptions = {
    // Expressed in percentage terms
    // e.g. 1.0 = 100%
    nativeGas: number;
  };

  export type NormalizedParams = {
    fee: bigint;
    amount: bigint;
    nativeGasAmount: bigint;
  };

  export interface ValidatedTransferParams<Op> {
    amount: string;
    options: Op;
    normalizedParams: NormalizedParams;
  }
}

type Op = AutomaticTokenBridgeRoute.InputOptions;
type Np = AutomaticTokenBridgeRoute.NormalizedParams;
type Tp = TransferParams<Op>;
type Vtp = AutomaticTokenBridgeRoute.ValidatedTransferParams<Op>;

type Vr = ValidationResult<Op>;
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

    if (isTokenId(this.request.source.id)) {
      return await atb.isRegisteredToken(this.request.source.id.address);
    }

    return true;
  }

  async validate(params: Tp): Promise<Vr> {
    try {
      const options = params.options ?? AutomaticTokenBridgeRoute.getDefaultOptions();

      const { destination } = this.request;
      let nativeGasPerc = options.nativeGas ?? 0.0;

      if (nativeGasPerc > 1.0 || nativeGasPerc < 0.0)
        throw new Error("Native gas must be between 0.0 and 1.0 (0% and 100%)");

      // If destination is native, max out the nativeGas requested
      if (destination && destination.id === "native" && nativeGasPerc === 0.0) nativeGasPerc = 1.0;

      const validatedParams: AutomaticTokenBridgeRoute.ValidatedTransferParams<Op> = {
        amount: params.amount,
        options: { ...params.options, nativeGas: nativeGasPerc },
        normalizedParams: await this.normalizeTransferParams(params),
      };

      return { valid: true, params: validatedParams };
    } catch (e) {
      return { valid: false, params, error: e as Error };
    }
  }

  async normalizeTransferParams(params: Tp): Promise<Np> {
    const amount = this.request.normalizeAmount(params.amount);

    const inputToken =
      this.request.source.id === "native"
        ? this.request.source.nativeWrapped!
        : this.request.source.id;

    const atb = await this.request.fromChain.getAutomaticTokenBridge();
    const fee = await atb.getRelayerFee(
      this.request.from.address,
      this.request.to,
      inputToken.address,
    );

    const transferableAmount = amount - fee;

    const { destination } = this.request;
    const options = params.options ?? AutomaticTokenBridgeRoute.getDefaultOptions();

    let nativeGasPerc = options.nativeGas ?? 0.0;
    // If destination is native, max out the nativeGas requested
    if (destination && destination.id === "native" && nativeGasPerc === 0.0) nativeGasPerc = 1.0;
    if (nativeGasPerc > 1.0 || nativeGasPerc < 0.0) {
      throw new Error("Native gas must be between 0.0 and 1.0 (0% and 100%)");
    }

    // Determine nativeGas
    let nativeGasAmount = 0n;
    if (nativeGasPerc > 0) {
      // TODO: currently supporting 2 decimals of the percentage requested
      const scale = 10000;
      const scaledGas = BigInt(options.nativeGas * scale);
      nativeGasAmount = (transferableAmount * scaledGas) / BigInt(scale);
    }

    return { fee, amount, nativeGasAmount };
  }

  async quote(params: Vtp) {
    return await TokenTransfer.quoteTransfer(
      this.request.fromChain,
      this.request.toChain,
      this.toTransferDetails(params),
    );
  }

  async initiate(signer: Signer, params: Vtp): Promise<TransferReceipt<"AutomaticTokenBridge">> {
    const transfer = this.toTransferDetails(params);
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

  private toTransferDetails(params: Vtp): TokenTransferDetails {
    const transfer = {
      automatic: true,
      from: this.request.from,
      to: this.request.to,
      amount: params.normalizedParams.amount,
      token: this.request.source.id,
      nativeGas: params.normalizedParams.nativeGasAmount,
    };

    return transfer;
  }
}
