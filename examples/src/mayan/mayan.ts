import {
  Quote,
  Token,
  fetchQuote,
  fetchTokenList,
  swapFromEvm,
  swapFromSolana,
} from "@mayanfinance/swap-sdk";
import {
  Chain,
  Network,
  Signer,
  TransactionId,
  TransferState,
  canonicalAddress,
  isTokenId,
  routes,
} from "@wormhole-foundation/connect-sdk";
import {
  NATIVE_CONTRACT_ADDRESS,
  TransactionStatus,
  getTransactionStatus,
  mayanEvmSigner,
  mayanSolanaSigner,
  toMayanChainName,
} from "./utils";

export namespace MayanRoute {
  export type Options = {
    gasDrop: number;
    slippage: number;
    deadlineInSeconds: number;
  };
  export type NormalizedParams = {
    //
  };
  export interface ValidatedParams extends routes.ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }

  export type MayanReceipt<N extends Network> = {
    from: Chain;
    to: Chain;
    request: routes.RouteTransferRequest<N>;
    originTxs: TransactionId[];
    txstatus?: TransactionStatus;
  };
}

type Q = Quote;
type Op = MayanRoute.Options;
type Vp = MayanRoute.ValidatedParams;
type R<N extends Network> = MayanRoute.MayanReceipt<N>;

type Tp = routes.TransferParams<Op>;
type Vr = routes.ValidationResult<Op>;

export class MayanRoute<N extends Network> extends routes.AutomaticRoute<N, Op, R<N>, Q> {
  MIN_DEADLINE = 60;
  MAX_SLIPPAGE = 100;

  NATIVE_GAS_DROPOFF_SUPPORTED = true;
  tokenList?: Token[];

  async isSupported(): Promise<boolean> {
    try {
      toMayanChainName(this.request.fromChain.chain);
      toMayanChainName(this.request.toChain.chain);
      return true;
    } catch {
      return false;
    }
  }

  async isAvailable(): Promise<boolean> {
    // assume native is always available
    const sourceToken = this.request.source;
    if (sourceToken.id === "native") return true;

    try {
      this.tokenList =
        this.tokenList ?? (await fetchTokenList(toMayanChainName(this.request.fromChain.chain)));

      const tokenAddress = canonicalAddress(sourceToken.id);

      const found = this.tokenList.find(
        (token) => token.contract === tokenAddress || token.mint === tokenAddress,
      );

      if (!found) throw new Error("Could not find token in token list");
    } catch (e) {
      console.error(e);
      return false;
    }

    return true;
  }

  static getDefaultOptions(): Op {
    return { gasDrop: 0, slippage: 3, deadlineInSeconds: 60 * 10 };
  }

  async validate(params: Tp): Promise<Vr> {
    try {
      params.options = params.options ?? MayanRoute.getDefaultOptions();

      if (params.options.slippage > this.MAX_SLIPPAGE)
        throw new Error("Slippage must be less than 100%");
      if (params.options.deadlineInSeconds < this.MIN_DEADLINE)
        throw new Error("Deadline must be at least 60 seconds");

      return { valid: true, params } as Vr;
    } catch (e) {
      return { valid: false, params, error: e as Error };
    }
  }

  async quote(params: Vp) {
    const { source, destination, from, to } = this.request;

    const sourceTokenAddress = isTokenId(source.id)
      ? canonicalAddress(source.id)
      : NATIVE_CONTRACT_ADDRESS;

    const destTokenAddress =
      destination && isTokenId(destination.id)
        ? canonicalAddress(destination.id)
        : NATIVE_CONTRACT_ADDRESS;

    const quoteOpts = {
      amount: Number(params.amount),
      fromToken: sourceTokenAddress,
      toToken: destTokenAddress,
      fromChain: toMayanChainName(from.chain),
      toChain: toMayanChainName(to.chain),
      ...params.options,
    };

    return await fetchQuote(quoteOpts);
  }

  async initiate(signer: Signer, params: Vp) {
    const originAddress = canonicalAddress(this.request.from);
    const destinationAddress = canonicalAddress(this.request.to);

    try {
      const quote = await this.quote(params);

      const rpc = await this.request.fromChain.getRpc();
      let txhash: string;
      if (this.request.from.chain === "Solana") {
        txhash = await swapFromSolana(
          quote,
          originAddress,
          destinationAddress,
          params.options.deadlineInSeconds,
          undefined,
          mayanSolanaSigner(signer),
          rpc,
        );
      } else {
        const txres = await swapFromEvm(
          quote,
          destinationAddress,
          params.options.deadlineInSeconds,
          undefined,
          rpc,
          mayanEvmSigner(signer),
        );

        txhash = txres.hash;
      }

      const txid = { chain: this.request.from.chain, txid: txhash };

      return {
        from: this.request.from.chain,
        to: this.request.to.chain,
        state: TransferState.SourceInitiated,
        request: this.request,
        originTxs: [txid],
      };
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  public override async *track(receipt: R<N>, timeout?: number) {
    const txstatus = await getTransactionStatus(receipt.originTxs[receipt.originTxs.length - 1]!);
    if (!txstatus) return;
    yield { ...receipt, txstatus };
  }
}
