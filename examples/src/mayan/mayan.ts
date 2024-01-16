import {
  Quote,
  Token,
  fetchQuote,
  fetchTokenList,
  swapFromEvm,
  swapFromSolana,
} from "@mayanfinance/swap-sdk";

import {
  TransferReceipt,
  TransferState,
  isSourceInitiated,
  routes,
} from "@wormhole-foundation/connect-sdk";
import { Network, ProtocolName } from "@wormhole-foundation/sdk-base";
import { Signer, canonicalAddress, isTokenId } from "@wormhole-foundation/sdk-definitions";
import {
  NATIVE_CONTRACT_ADDRESS,
  getTransactionStatus,
  mayanEvmSigner,
  mayanSolanaSigner,
  toMayanChainName,
} from "./utils";
import { ValidatedTransferParams } from "@wormhole-foundation/connect-sdk/src/routes";

export namespace MayanRoute {
  export type Options = {
    gasDrop: number;
    slippage: number;
  };
  export type NormalizedParams = {
    //
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Q = Quote;
type Op = MayanRoute.Options;
type Vp = MayanRoute.ValidatedParams;

type Tp = routes.TransferParams<Op>;
type Vr = routes.ValidationResult<Op>;

export class MayanRoute<N extends Network> extends routes.AutomaticRoute<N, Op, Q> {
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
    return { gasDrop: 0, slippage: 3 };
  }

  async validate(params: Tp): Promise<Vr> {
    try {
      // TODO: ...
      params.options = params.options ?? MayanRoute.getDefaultOptions();
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

  async initiate(signer: Signer, params: Vp): Promise<TransferReceipt<ProtocolName>> {
    const deadlineInSeconds = 60;

    const originAddress = canonicalAddress(this.request.from);
    const destinationAddress = canonicalAddress(this.request.to);

    try {
      const quote = await this.quote(params);

      const rpc = await this.request.fromChain.getRpc();
      let txid: string;
      if (this.request.from.chain === "Solana") {
        txid = await swapFromSolana(
          quote,
          originAddress,
          destinationAddress,
          deadlineInSeconds,
          undefined,
          mayanSolanaSigner(signer),
          rpc,
        );
      } else {
        const txres = await swapFromEvm(
          quote,
          destinationAddress,
          deadlineInSeconds,
          undefined,
          rpc,
          mayanEvmSigner(signer),
        );

        txid = txres.hash;
      }

      return {
        protocol: "WormholeCore", // TODO: this is a lie
        from: this.request.from.chain,
        to: this.request.to.chain,
        state: TransferState.SourceInitiated,
        request: this.request,
        originTxs: [{ chain: this.request.from.chain, txid }],
      };
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  public override async *track(receipt: TransferReceipt<"WormholeCore">, timeout?: number) {
    if (isSourceInitiated(receipt)) {
      const txstatus = await getTransactionStatus(receipt.originTxs[receipt.originTxs.length - 1]!);
      if (!txstatus) return;
      console.log(txstatus);
    }
  }
}
