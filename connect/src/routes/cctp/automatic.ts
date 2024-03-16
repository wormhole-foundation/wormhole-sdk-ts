import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import { circle, contracts, amount } from "@wormhole-foundation/sdk-base";
import type {
  ChainContext,
  CircleTransferDetails,
  Signer,
  TokenId,
} from "@wormhole-foundation/sdk-definitions";
import { nativeTokenId } from "@wormhole-foundation/sdk-definitions";
import type { CircleAttestationReceipt } from "../../protocols/cctpTransfer.js";
import { CircleTransfer } from "../../protocols/cctpTransfer.js";
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
import { Wormhole } from "../../wormhole.js";

export namespace AutomaticCCTPRoute {
  export type Options = {
    // 0.0 - 1.0 percentage
    nativeGas?: number;
  };

  export type NormalizedParams = {
    amount: amount.Amount;
    fee: amount.Amount;
    nativeGasAmount: amount.Amount;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = AutomaticCCTPRoute.Options;
type Vp = AutomaticCCTPRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type Q = Quote<Op, Vp>;
type QR = QuoteResult<Op, Vp>;
type R = Receipt<CircleAttestationReceipt>;

export class AutomaticCCTPRoute<N extends Network>
  extends AutomaticRoute<N, Op, Vp, R>
  implements StaticRouteMethods<typeof AutomaticCCTPRoute>
{
  NATIVE_GAS_DROPOFF_SUPPORTED = true;

  static meta = {
    name: "AutomaticCCTP",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }
  // get the list of chains this route supports
  static supportedChains(network: Network): Chain[] {
    if (contracts.circleContractChains.has(network)) {
      return contracts.circleContractChains.get(network)!;
    }
    return [];
  }

  // get the list of source tokens that are possible to send
  static async supportedSourceTokens(fromChain: ChainContext<Network>): Promise<TokenId[]> {
    const { network, chain } = fromChain;
    if (!circle.usdcContract.has(network, chain)) return [];
    return [Wormhole.chainAddress(chain, circle.usdcContract.get(network, chain)!)];
  }

  // get the liist of destination tokens that may be recieved on the destination chain
  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    const { network, chain } = toChain;
    if (!circle.usdcContract.has(network, chain)) return [];
    return [
      nativeTokenId(chain),
      Wormhole.chainAddress(chain, circle.usdcContract.get(network, chain)!),
    ];
  }

  static isProtocolSupported<N extends Network>(chain: ChainContext<N>): boolean {
    return chain.supportsAutomaticCircleBridge();
  }

  getDefaultOptions(): Op {
    return {
      nativeGas: 0.0,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async validate(params: Tp): Promise<Vr> {
    try {
      const options = params.options ?? this.getDefaultOptions();
      const normalizedParams = await this.normalizeTransferParams(params);

      const validatedParams: Vp = {
        normalizedParams,
        options,
        ...params,
      };

      return { valid: true, params: validatedParams };
    } catch (e) {
      return {
        valid: false,
        params,
        error: e as Error,
      };
    }
  }

  async quote(params: Vp): Promise<QR> {
    try {
      return this.request.displayQuote(
        await CircleTransfer.quoteTransfer(
          this.request.fromChain,
          this.request.toChain,
          this.toTransferDetails(params),
        ),
        params,
      );
    } catch (e) {
      return {
        success: false,
        error: e as Error,
      };
    }
  }

  private async normalizeTransferParams(params: Tp): Promise<AutomaticCCTPRoute.NormalizedParams> {
    const amt = this.request.parseAmount(params.amount);

    const ctb = await this.request.fromChain.getAutomaticCircleBridge();
    const fee = await ctb.getRelayerFee(this.request.to.chain);

    const minAmount = (fee * 105n) / 100n;
    if (amount.units(amt) < minAmount) {
      throw new Error(
        `Minimum amount is ${amount.display(this.request.amountFromBaseUnits(minAmount))}`,
      );
    }

    const transferableAmount = amount.units(amt) - fee;

    const options = params.options ?? this.getDefaultOptions();

    const nativeGasPerc = options.nativeGas ?? 0.0;
    if (nativeGasPerc > 1.0 || nativeGasPerc < 0.0)
      throw new Error("Native gas must be between 0.0 and 1.0 (0% and 100%)");

    let nativeGasAmount = 0n;

    if (nativeGasPerc > 0.0) {
      const scale = 10000;
      const scaledGas = BigInt(nativeGasPerc * scale);
      nativeGasAmount = (transferableAmount * scaledGas) / BigInt(scale);
    }

    return {
      fee: this.request.amountFromBaseUnits(fee),
      amount: amt,
      nativeGasAmount: this.request.amountFromBaseUnits(nativeGasAmount),
    };
  }

  private toTransferDetails(params: Vp): CircleTransferDetails {
    return {
      from: this.request.from,
      to: this.request.to,
      amount: amount.units(params.normalizedParams.amount),
      automatic: true,
      nativeGas: amount.units(params.normalizedParams.nativeGasAmount),
    };
  }

  async initiate(signer: Signer, quote: Q): Promise<R> {
    const { params } = quote;
    let transfer = this.toTransferDetails(params);
    let txids = await CircleTransfer.transfer<N>(this.request.fromChain, transfer, signer);

    const msg = await CircleTransfer.getTransferMessage(
      this.request.fromChain,
      txids[txids.length - 1]!.txid,
    );

    return {
      from: transfer.from.chain,
      to: transfer.to.chain,
      state: TransferState.SourceFinalized,
      originTxs: txids,
      attestation: { id: msg.id, attestation: { message: msg.message } },
    };
  }

  public override async *track(receipt: R, timeout?: number) {
    yield* CircleTransfer.track(
      this.wh,
      receipt,
      timeout,
      this.request.fromChain,
      this.request.toChain,
    );
  }
}
