import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import { amount, circle, contracts } from "@wormhole-foundation/sdk-base";
import {
  isSameToken,
  type ChainAddress,
  type ChainContext,
  type CircleTransferDetails,
  type Signer,
  type TokenId,
} from "@wormhole-foundation/sdk-definitions";
import { CircleTransfer } from "../../protocols/cctp/cctpTransfer.js";
import { TransferState } from "../../types.js";
import { Wormhole } from "../../wormhole.js";
import type { StaticRouteMethods } from "../route.js";
import { AutomaticRoute } from "../route.js";
import { MinAmountError } from "../types.js";
import type {
  Quote,
  QuoteResult,
  Receipt,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types.js";
import type { RouteTransferRequest } from "../request.js";

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
type R = Receipt<CircleTransfer.AttestationReceipt>;

export class AutomaticCCTPRoute<N extends Network>
  extends AutomaticRoute<N, Op, Vp, R>
  implements StaticRouteMethods<typeof AutomaticCCTPRoute>
{
  static NATIVE_GAS_DROPOFF_SUPPORTED = true;

  static meta = {
    name: "AutomaticCCTP",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }
  // get the list of chains this route supports
  static supportedChains(network: Network): Chain[] {
    if (contracts.circleContractChains.has(network)) {
      const circleSupportedChains = contracts.circleContractChains.get(network) as Chain[];
      return circleSupportedChains.filter((c: Chain) => {
        return contracts.circleContracts.get(network, c)?.wormholeRelayer!!;
      });
    }
    return [];
  }

  // get the list of source tokens that are possible to send
  static async supportedSourceTokens(fromChain: ChainContext<Network>): Promise<TokenId[]> {
    const { network, chain } = fromChain;
    if (!circle.usdcContract.has(network, chain)) return [];
    return [Wormhole.chainAddress(chain, circle.usdcContract.get(network, chain)!)];
  }

  // get the list of destination tokens that may be received on the destination chain
  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    // Ensure the source token is USDC
    const sourceChainUsdcContract = circle.usdcContract.get(fromChain.network, fromChain.chain);
    if (!sourceChainUsdcContract) return [];
    if (!isSameToken(sourceToken, Wormhole.tokenId(fromChain.chain, sourceChainUsdcContract))) {
      return [];
    }

    const { network, chain } = toChain;
    if (!circle.usdcContract.has(network, chain)) return [];
    return [Wormhole.chainAddress(chain, circle.usdcContract.get(network, chain)!)];
  }

  getDefaultOptions(): Op {
    return {
      nativeGas: 0.0,
    };
  }

  async validate(request: RouteTransferRequest<N>, params: Tp): Promise<Vr> {
    try {
      const options = params.options ?? this.getDefaultOptions();
      const normalizedParams = await this.normalizeTransferParams(request, params);

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

  async quote(request: RouteTransferRequest<N>, params: Vp): Promise<QR> {
    try {
      return request.displayQuote(
        await CircleTransfer.quoteTransfer(request.fromChain, request.toChain, {
          automatic: true,
          amount: amount.units(params.normalizedParams.amount),
          nativeGas: amount.units(params.normalizedParams.nativeGasAmount),
        }),
        params,
      );
    } catch (e) {
      return {
        success: false,
        error: e as Error,
      };
    }
  }

  private async normalizeTransferParams(
    request: RouteTransferRequest<N>,
    params: Tp,
  ): Promise<AutomaticCCTPRoute.NormalizedParams> {
    const amt = request.parseAmount(params.amount);

    const ctb = await request.fromChain.getAutomaticCircleBridge();
    const fee = await ctb.getRelayerFee(request.toChain.chain);

    const minAmount = (fee * 105n) / 100n;
    if (amount.units(amt) < minAmount) {
      throw new MinAmountError(amount.fromBaseUnits(minAmount, amt.decimals));
    }

    const redeemableAmount = amount.units(amt) - fee;

    const options = params.options ?? this.getDefaultOptions();

    const nativeGasPerc = options.nativeGas ?? 0.0;
    if (nativeGasPerc > 1.0 || nativeGasPerc < 0.0)
      throw new Error("Native gas must be between 0.0 and 1.0 (0% and 100%)");

    let nativeGasAmount = 0n;

    if (nativeGasPerc > 0.0) {
      const dcb = await request.toChain.getAutomaticCircleBridge();
      let maxSwapAmount = await dcb.maxSwapAmount();
      if (redeemableAmount < maxSwapAmount) {
        // can't swap more than the receivable amount
        maxSwapAmount = redeemableAmount;
      }

      const scale = 10000;
      const scaledGas = BigInt(Math.floor(nativeGasPerc * scale));
      // the native gas percentage is applied to the max swap amount
      nativeGasAmount = (maxSwapAmount * scaledGas) / BigInt(scale);
      if (nativeGasAmount === redeemableAmount && nativeGasAmount > 0n) {
        // edge case: transfer will revert if the native gas amount is equal to the redeemable amount
        nativeGasAmount -= 1n;
      }
    }

    return {
      fee: request.amountFromBaseUnits(fee),
      amount: amt,
      nativeGasAmount: request.amountFromBaseUnits(nativeGasAmount),
    };
  }

  private toTransferDetails(
    params: Vp,
    from: ChainAddress,
    to: ChainAddress,
  ): CircleTransferDetails {
    return {
      from,
      to,
      amount: amount.units(params.normalizedParams.amount),
      automatic: true,
      nativeGas: amount.units(params.normalizedParams.nativeGasAmount),
    };
  }

  async initiate(
    request: RouteTransferRequest<N>,
    signer: Signer,
    quote: Q,
    to: ChainAddress,
  ): Promise<R> {
    const { params } = quote;
    let transfer = this.toTransferDetails(
      params,
      Wormhole.chainAddress(signer.chain(), signer.address()),
      to,
    );
    let txids = await CircleTransfer.transfer<N>(request.fromChain, transfer, signer);

    const msg = await CircleTransfer.getTransferMessage(
      request.fromChain,
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
    yield* CircleTransfer.track(this.wh, receipt, timeout);
  }
}
