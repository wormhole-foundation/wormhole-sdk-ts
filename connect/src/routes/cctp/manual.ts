import { Chain, Network, circle, contracts } from "@wormhole-foundation/sdk-base";
import {
  ChainContext,
  CircleBridge,
  CircleTransferDetails,
  Signer,
  TokenId,
  TransactionId,
} from "@wormhole-foundation/sdk-definitions";
import { signSendWait } from "../../common";
import { CircleAttestationReceipt, CircleTransfer } from "../../protocols/cctpTransfer";
import { TransferQuote, TransferReceipt, TransferState, isAttested } from "../../types";
import { ManualRoute, StaticRouteMethods } from "../route";
import { TransferParams, ValidatedTransferParams, ValidationResult } from "../types";
import { Wormhole } from "../../wormhole";

export namespace CCTPRoute {
  export type Options = {
    payload?: Uint8Array;
  };

  export type NormalizedParams = {
    amount: bigint;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = CCTPRoute.Options;
type Vp = CCTPRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type Q = TransferQuote;
type R = TransferReceipt<CircleAttestationReceipt>;

export class CCTPRoute<N extends Network>
  extends ManualRoute<N, Op, R, Q>
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
    const amount = this.request.normalizeAmount(params.amount);

    if (amount < 0n) {
      return {
        valid: false,
        params,
        error: new Error("Amount must be positive"),
      };
    }

    const validatedParams: Vp = {
      normalizedParams: {
        amount,
      },
      options: params.options ?? this.getDefaultOptions(),
      ...params,
    };

    return { valid: true, params: validatedParams };
  }

  async quote(params: Vp) {
    return await CircleTransfer.quoteTransfer(
      this.request.fromChain,
      this.request.toChain,
      this.toTransferDetails(params),
    );
  }

  async initiate(signer: Signer, params: Vp): Promise<R> {
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

  async complete(signer: Signer, receipt: R): Promise<TransactionId[]> {
    if (!isAttested(receipt))
      throw new Error("The source must be finalized in order to complete the transfer");

    const { id, attestation: att } = receipt.attestation;
    if (CircleBridge.isCircleAttestation(att)) {
      const { message, attestation } = att;
      if (!attestation) throw new Error(`No Circle attestation for ${id}`);

      let cb = await this.request.toChain.getCircleBridge();
      let xfer = cb.redeem(this.request.to.address, message, attestation);
      return await signSendWait<N, Chain>(this.request.toChain, xfer, signer);
    } else {
      //
      return [];
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

  private toTransferDetails(params: Vp): CircleTransferDetails {
    return {
      from: this.request.from,
      to: this.request.to,
      amount: params.normalizedParams.amount,
      automatic: false,
      ...params.options,
    };
  }
}
