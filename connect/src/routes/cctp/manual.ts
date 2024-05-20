import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import { amount, circle, contracts } from "@wormhole-foundation/sdk-base";
import type {
  ChainContext,
  CircleTransferDetails,
  Signer,
  TokenId,
} from "@wormhole-foundation/sdk-definitions";
import { CircleBridge, isSameToken } from "@wormhole-foundation/sdk-definitions";
import { signSendWait } from "../../common.js";
import { CircleTransfer } from "../../protocols/cctp/cctpTransfer.js";
import type { TransferReceipt } from "../../types.js";
import { TransferState, isAttested } from "../../types.js";
import { Wormhole } from "../../wormhole.js";
import type { StaticRouteMethods } from "../route.js";
import { ManualRoute } from "../route.js";
import type {
  Quote,
  QuoteResult,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types.js";
import { ChainAddress } from "@wormhole-foundation/sdk-definitions";

export namespace CCTPRoute {
  export type Options = {
    payload?: Uint8Array;
  };

  export type NormalizedParams = {
    amount: amount.Amount;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = CCTPRoute.Options;
type Vp = CCTPRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type Q = Quote<Op, Vp>;
type QR = QuoteResult<Op, Vp>;
type R = TransferReceipt<CircleTransfer.AttestationReceipt>;

export class CCTPRoute<N extends Network>
  extends ManualRoute<N, Op, Vp, R>
  implements StaticRouteMethods<typeof CCTPRoute>
{
  static meta = {
    name: "ManualCCTP",
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
    // Ensure the source token is USDC
    const sourceChainUsdcContract = circle.usdcContract.get(fromChain.network, fromChain.chain);
    if (!sourceChainUsdcContract ) return [];
    if (!isSameToken(
      sourceToken,
      Wormhole.tokenId(fromChain.chain, sourceChainUsdcContract),
    )){
      return [];
    }

    const { network, chain } = toChain;
    if (!circle.usdcContract.has(network, chain)) return [];
    return [Wormhole.chainAddress(chain, circle.usdcContract.get(network, chain)!)];
  }

  static isProtocolSupported<N extends Network>(chain: ChainContext<N>): boolean {
    return chain.supportsCircleBridge();
  }

  getDefaultOptions(): Op {
    return {
      payload: undefined,
    };
  }

  async validate(params: Tp): Promise<Vr> {
    const amount = this.request.parseAmount(params.amount);

    const validatedParams: Vp = {
      normalizedParams: {
        amount,
      },
      options: params.options ?? this.getDefaultOptions(),
      ...params,
    };

    return { valid: true, params: validatedParams };
  }

  async quote(params: Vp): Promise<QR> {
    try {
      return this.request.displayQuote(
        await CircleTransfer.quoteTransfer(this.request.fromChain, this.request.toChain, {
          automatic: false,
          amount: amount.units(params.normalizedParams.amount),
          ...params.options,
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

  async initiate(signer: Signer, quote: Q, to: ChainAddress): Promise<R> {
    const { params } = quote;
    const transfer = await CircleTransfer.destinationOverrides(
      this.request.fromChain,
      this.request.toChain,
      this.toTransferDetails(params, Wormhole.chainAddress(signer.chain(), signer.address()), to),
    );
    const txids = await CircleTransfer.transfer<N>(this.request.fromChain, transfer, signer);
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

  async complete(signer: Signer, receipt: R): Promise<R> {
    if (!isAttested(receipt))
      throw new Error("The source must be finalized in order to complete the transfer");

    const { id, attestation: att } = receipt.attestation;
    if (CircleBridge.isCircleAttestation(att)) {
      const { message, attestation } = att;
      if (!attestation) throw new Error(`No Circle attestation for ${id}`);

      const cb = await this.request.toChain.getCircleBridge();
      const xfer = cb.redeem(message.payload.mintRecipient, message, attestation);
      const dstTxids = await signSendWait<N, Chain>(this.request.toChain, xfer, signer);
      return {
        ...receipt,
        state: TransferState.DestinationInitiated,
        destinationTxs: dstTxids,
      };
    } else {
      //
      return receipt;
    }
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

  private toTransferDetails(
    params: Vp,
    from: ChainAddress,
    to: ChainAddress,
  ): CircleTransferDetails {
    return {
      from,
      to,
      amount: amount.units(params.normalizedParams.amount),
      automatic: false,
      ...params.options,
    };
  }
}
