import { Chain, Network, amount, contracts } from "@wormhole-foundation/sdk-base";
import {
  ChainContext,
  Signer,
  TokenId,
  TokenTransferDetails,
  TransactionId,
} from "@wormhole-foundation/sdk-definitions";
import { TokenTransfer, TokenTransferVAA } from "../../protocols/tokenTransfer";
import { AttestationReceipt, TransferReceipt, TransferState, isAttested } from "../../types";
import { Wormhole } from "../../wormhole";
import { ManualRoute, StaticRouteMethods } from "../route";
import {
  Quote,
  QuoteResult,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types";

export namespace TokenBridgeRoute {
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

type Op = TokenBridgeRoute.Options;
type Vp = TokenBridgeRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type QR = QuoteResult<Op, Vp>;
type Q = Quote<Op, Vp>;
type R = TransferReceipt<AttestationReceipt<"TokenBridge">>;

export class TokenBridgeRoute<N extends Network>
  extends ManualRoute<N, Op, Vp, R>
  implements StaticRouteMethods<typeof TokenBridgeRoute>
{
  static meta = {
    name: "ManualTokenBridge",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }
  // get the list of chains this route supports
  static supportedChains(network: Network): Chain[] {
    return contracts.tokenBridgeChains(network);
  }

  // get the list of source tokens that are possible to send
  static async supportedSourceTokens(fromChain: ChainContext<Network>): Promise<TokenId[]> {
    // Default list for the chain
    return Object.values(fromChain.config.tokenMap!).map((td) =>
      Wormhole.tokenId(td.chain, td.address),
    );
  }

  // get the liist of destination tokens that may be recieved on the destination chain
  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    return [await TokenTransfer.lookupDestinationToken(fromChain, toChain, sourceToken)];
  }

  static isProtocolSupported<N extends Network>(chain: ChainContext<N>): boolean {
    return chain.supportsTokenBridge();
  }

  getDefaultOptions(): Op {
    return { payload: undefined };
  }

  async validate(params: Tp): Promise<Vr> {
    const amt = amount.parse(params.amount, this.request.source.decimals);

    const validatedParams: Vp = {
      amount: params.amount,
      normalizedParams: { amount: amt },
      options: {},
    };

    return { valid: true, params: validatedParams };
  }

  async quote(params: Vp): Promise<QR> {
    return this.request.displayQuote(
      await TokenTransfer.quoteTransfer(
        this.request.fromChain,
        this.request.toChain,
        this.toTransferDetails(params),
      ),
      params,
    );
  }

  async initiate(signer: Signer, quote: Q): Promise<R> {
    const { params } = quote;
    const transfer = this.toTransferDetails(params);
    const txids = await TokenTransfer.transfer<N>(this.request.fromChain, transfer, signer);
    const msg = await TokenTransfer.getTransferMessage(
      this.request.fromChain,
      txids[txids.length - 1]!.txid,
    );

    return {
      from: transfer.from.chain,
      to: transfer.to.chain,
      state: TransferState.SourceFinalized,
      originTxs: txids,
      attestation: { id: msg },
    };
  }

  async complete(signer: Signer, receipt: R): Promise<TransactionId[]> {
    if (!isAttested(receipt))
      throw new Error("The source must be finalized in order to complete the transfer");
    return await TokenTransfer.redeem<N>(
      this.request.toChain,
      // todo: ew?
      receipt.attestation.attestation as TokenTransferVAA,
      signer,
    );
  }

  public override async *track(receipt: R, timeout?: number) {
    yield* TokenTransfer.track(
      this.wh,
      receipt,
      timeout,
      this.request.fromChain,
      this.request.toChain,
    );
  }

  private toTransferDetails(params: Vp): TokenTransferDetails {
    return {
      token: this.request.source.id,
      from: this.request.from,
      to: this.request.to,
      amount: amount.units(params.normalizedParams.amount),
      ...params.options,
    };
  }
}
