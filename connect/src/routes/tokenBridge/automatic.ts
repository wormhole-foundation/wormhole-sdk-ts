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
import { AutomaticRoute, ValidationResult } from "../route";

export namespace AutomaticTokenBridgeRoute {
  export type Options = {
    nativeGas?: bigint;
  };
}

type Op = AutomaticTokenBridgeRoute.Options;
export class AutomaticTokenBridgeRoute<N extends Network> extends AutomaticRoute<N, Op> {
  NATIVE_GAS_DROPOFF_SUPPORTED = true;

  static isSupported<N extends Network>(
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): boolean {
    // No transfers to same chain
    if (fromChain.chain === toChain.chain) return false;

    // No transfers to unsupported chains
    if (!fromChain.supportsAutomaticTokenBridge()) return false;
    if (!toChain.supportsAutomaticTokenBridge()) return false;

    return true;
  }
  static getDefaultOptions(): Op {
    return { nativeGas: 0n };
  }

  async isAvailable(): Promise<boolean> {
    const atb = await this.fromChain.getAutomaticTokenBridge();

    if (isTokenId(this.request.source))
      return await atb.isRegisteredToken(this.request.source.address);

    return true;
  }

  async validate(options?: Op): Promise<ValidationResult<Op>> {
    options = options ?? AutomaticTokenBridgeRoute.getDefaultOptions();

    try {
      const { amount, destination } = this.request;

      const quote = await this.quote(options);
      const { amount: fee } = quote.relayFee!;

      if (amount < fee) throw new Error(`Amount must be greater than fee:  ${amount} > ${fee}`);

      options.nativeGas = options.nativeGas ?? 0n;

      if (destination) {
        if (isTokenId(destination)) {
          if (!isSameToken(quote.destinationToken.token, destination))
            throw new Error("Cannot convert between these tokens");
        } else {
          // considered unset for our purposes
          // they've asked for native gas dropoff implicitly
          // max out native gas. This value may be negative but we check that later
          if (options.nativeGas === 0n) options.nativeGas = amount - fee;
          // strict equality from here,
          //  if it came in set
          //  and they specified native dest token
          //  then nativeGas must be exactly the same as amount - fee
          if (options.nativeGas !== amount - fee)
            throw new Error("Native gas cannot be greater than amount - fee");
        }
      }

      if (options.nativeGas < 0n) throw new Error("Native gas cannot be negative");

      const transferableAmount = amount - options.nativeGas;
      if (transferableAmount < 0n) throw new Error("Native gas cannot be greater than amount");
      if (transferableAmount < fee)
        throw new Error(
          `Amount - native gas requested must be greater than fee:  ${transferableAmount} > ${fee}`,
        );

      return { valid: true, quote, options };
    } catch (e) {
      return { valid: false, options, error: e as Error };
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
