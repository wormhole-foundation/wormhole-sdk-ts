import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import { amount, contracts } from "@wormhole-foundation/sdk-base";
import type {
  ChainContext,
  Signer,
  TokenId,
  TokenTransferDetails,
} from "@wormhole-foundation/sdk-definitions";
import { isNative, isTokenId, nativeTokenId } from "@wormhole-foundation/sdk-definitions";
import { TokenTransfer } from "../../protocols/tokenBridge/tokenTransfer.js";
import type { AttestationReceipt, SourceInitiatedTransferReceipt } from "../../types.js";
import { TransferState } from "../../types.js";
import type { StaticRouteMethods } from "../route.js";
import { AutomaticRoute } from "../route.js";
import type {
  Quote,
  QuoteResult,
  Receipt,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types.js";
import { ChainAddress } from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../../wormhole.js";

export namespace AutomaticTokenBridgeRoute {
  export type Options = {
    // Expressed in percentage terms
    // e.g. 1.0 = 100%
    nativeGas: number;
  };

  export type NormalizedParams = {
    fee: amount.Amount;
    amount: amount.Amount;
    nativeGasAmount: amount.Amount;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = AutomaticTokenBridgeRoute.Options;
type Vp = AutomaticTokenBridgeRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;
type R = Receipt<AttestationReceipt<"AutomaticTokenBridge">>;
type QR = QuoteResult<Op, Vp>;
type Q = Quote<Op, Vp>;

export class AutomaticTokenBridgeRoute<N extends Network>
  extends AutomaticRoute<N, Op, Vp, R>
  implements StaticRouteMethods<typeof AutomaticTokenBridgeRoute>
{
  NATIVE_GAS_DROPOFF_SUPPORTED = true;

  static meta = {
    name: "AutomaticTokenBridge",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }
  // get the list of chains this route supports
  static supportedChains(network: Network): Chain[] {
    if (contracts.tokenBridgeRelayerChains.has(network)) {
      return contracts.tokenBridgeRelayerChains.get(network)!;
    }
    return [];
  }

  // get the list of source tokens that are possible to send
  static async supportedSourceTokens(fromChain: ChainContext<Network>): Promise<TokenId[]> {
    const atb = await fromChain.getAutomaticTokenBridge();
    const registered = await atb.getRegisteredTokens();
    return [
      nativeTokenId(fromChain.chain),
      ...registered.map((v) => {
        return { chain: fromChain.chain, address: v };
      }),
    ];
  }

  // get the list of destination tokens that may be recieved on the destination chain
  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    return [await TokenTransfer.lookupDestinationToken(fromChain, toChain, sourceToken)];
  }

  static isProtocolSupported<N extends Network>(chain: ChainContext<N>): boolean {
    return chain.supportsAutomaticTokenBridge();
  }

  getDefaultOptions(): Op {
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
      const options = params.options ?? this.getDefaultOptions();

      if (options.nativeGas && (options.nativeGas > 1.0 || options.nativeGas < 0.0))
        throw new Error("Native gas must be between 0.0 and 1.0 (0% and 100%)");

      // If destination is native, max out the nativeGas requested
      const { destination } = this.request;
      if (isNative(destination.id.address) && options.nativeGas === 0.0) options.nativeGas = 1.0;

      const updatedParams = { ...params, options };
      const validatedParams: Vp = {
        ...updatedParams,
        normalizedParams: await this.normalizeTransferParams(updatedParams),
      };

      return { valid: true, params: validatedParams };
    } catch (e) {
      return { valid: false, params, error: e as Error };
    }
  }

  private async normalizeTransferParams(
    params: Tp,
  ): Promise<AutomaticTokenBridgeRoute.NormalizedParams> {
    const amt = this.request.parseAmount(params.amount);

    const inputToken = isNative(this.request.source.id.address)
      ? await this.request.fromChain.getNativeWrappedTokenId()
      : this.request.source.id;

    const atb = await this.request.fromChain.getAutomaticTokenBridge();
    const fee: bigint = await atb.getRelayerFee(this.request.toChain.chain, inputToken.address);

    // Min amount is fee + 5%
    const minAmount = (fee * 105n) / 100n;
    if (amount.units(amt) < minAmount) {
      throw new Error(
        `Minimum amount is ${amount.display({
          amount: minAmount.toString(),
          decimals: amt.decimals,
        })}`,
      );
    }

    const redeemableAmount = amount.units(amt) - fee;

    // Determine nativeGas
    let nativeGasAmount = 0n;
    if (params.options && params.options.nativeGas > 0) {
      const scale = 10000;
      const scaledGas = BigInt(params.options.nativeGas * scale);
      nativeGasAmount = (redeemableAmount * scaledGas) / BigInt(scale);
    }

    return {
      fee: amount.fromBaseUnits(fee, this.request.source.decimals),
      amount: amt,
      nativeGasAmount: amount.fromBaseUnits(nativeGasAmount, this.request.source.decimals),
    };
  }

  async quote(params: Vp): Promise<QR> {
    try {
      let quote = await TokenTransfer.quoteTransfer(
        this.wh,
        this.request.fromChain,
        this.request.toChain,
        {
          automatic: true,
          amount: amount.units(params.normalizedParams.amount),
          token: this.request.source.id,
          nativeGas: amount.units(params.normalizedParams.nativeGasAmount),
        },
      );
      return this.request.displayQuote(quote, params);
    } catch (e) {
      return {
        success: false,
        error: e as Error,
      };
    }
  }

  async initiate(signer: Signer, quote: Q, to: ChainAddress): Promise<R> {
    const { params } = quote;
    const transfer = this.toTransferDetails(
      params,
      Wormhole.chainAddress(signer.chain(), signer.address()),
      to,
    );
    const txids = await TokenTransfer.transfer<N>(this.request.fromChain, transfer, signer);
    return {
      from: transfer.from.chain,
      to: transfer.to.chain,
      state: TransferState.SourceInitiated,
      originTxs: txids,
    } satisfies SourceInitiatedTransferReceipt;
  }

  public override async *track(receipt: R, timeout?: number) {
    try {
      yield* TokenTransfer.track(
        this.wh,
        receipt,
        timeout,
        this.request.fromChain,
        this.request.toChain,
      );
    } catch (e) {
      throw e;
    }
  }

  private toTransferDetails(
    params: Vp,
    from: ChainAddress,
    to: ChainAddress,
  ): TokenTransferDetails {
    const transfer = {
      from,
      to,
      automatic: true,
      amount: amount.units(params.normalizedParams.amount),
      token: this.request.source.id,
      nativeGas: amount.units(params.normalizedParams.nativeGasAmount),
    };

    return transfer;
  }
}
