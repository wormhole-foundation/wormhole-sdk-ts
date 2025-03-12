import { amount, Chain, contracts, Network, tbtc } from "@wormhole-foundation/sdk-base";
import { ManualRoute, StaticRouteMethods } from "../route.js";
import {
  ChainAddress,
  ChainContext,
  Signer,
  TokenId,
  TransactionId,
} from "@wormhole-foundation/sdk-definitions";
import {
  Options,
  Quote,
  QuoteResult,
  Receipt,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types.js";
import type { AttestationReceipt, TransferReceipt } from "../../types.js";
import { RouteTransferRequest } from "../request.js";
import { isSameToken } from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../../wormhole.js";
import { finality } from "@wormhole-foundation/sdk-base";
import { guardians } from "@wormhole-foundation/sdk-base";

export namespace TBTCRoute {
  export type NormalizedParams = {
    amount: amount.Amount;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = Options;
type Vp = TBTCRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type QR = QuoteResult<Op, Vp>;
type Q = Quote<Op, Vp>;
type R = TransferReceipt<AttestationReceipt<"TbtcBridge">>;

export class TBTCRoute<N extends Network>
  extends ManualRoute<N>
  implements StaticRouteMethods<typeof TBTCRoute>
{
  static meta = {
    name: "TbtcBridge",
    // provider: 'Threshold'
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }

  static supportedChains(network: Network): Chain[] {
    // wormhole-wrapped ethereum tbtc is the highway token,
    // so any chain that supports the token bridge is supported
    return contracts.tokenBridgeChains(network);
  }

  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    if (sourceToken.chain !== fromChain.chain) return [];

    if (!(await this.isSourceTokenSupported(sourceToken, fromChain))) {
      return [];
    }

    const tbtcToken = tbtc.tbtcTokens.get(toChain.network, toChain.chain);
    if (tbtcToken) {
      return [Wormhole.tokenId(toChain.chain, tbtcToken)];
    }

    const tb = await toChain.getTokenBridge();
    const ethTbtc = this.getEthTbtcToken(toChain.network);
    try {
      const wrappedTbtc = await tb.getWrappedAsset(ethTbtc);
      return [Wormhole.tokenId(fromChain.chain, wrappedTbtc.toString())];
    } catch (e: any) {
      if (e.message.includes("not a wrapped asset")) return [];
      throw e;
    }
  }

  getDefaultOptions(): Op {
    return {};
  }

  async validate(request: RouteTransferRequest<N>, params: Tp): Promise<Vr> {
    const amount = request.parseAmount(params.amount);

    const validatedParams: Vp = {
      normalizedParams: {
        amount,
      },
      options: params.options ?? this.getDefaultOptions(),
      ...params,
    };

    return { valid: true, params: validatedParams };
  }

  async quote(request: RouteTransferRequest<N>, params: Vp): Promise<QR> {
    const eta =
      finality.estimateFinalityTime(request.fromChain.chain) + guardians.guardianAttestationEta;

    return {
      success: true,
      params,
      sourceToken: {
        token: request.source.id,
        amount: params.normalizedParams.amount,
      },
      destinationToken: {
        token: request.destination.id,
        amount: params.normalizedParams.amount,
      },
      eta,
    };
  }

  async initiate(
    request: RouteTransferRequest<N>,
    signer: Signer,
    quote: Q,
    to: ChainAddress,
  ): Promise<R> {
    throw new Error("Method not implemented.");
  }

  async complete(signer: Signer, receipt: R): Promise<R> {
    //if (!isAttested(receipt))
    //  throw new Error("The source must be finalized in order to complete the transfer");
    //const toChain = this.wh.getChain(receipt.to);
    //const dstTxIds = await TokenTransfer.redeem<N>(
    //  toChain,
    //  receipt.attestation.attestation as TokenTransfer.VAA,
    //  signer,
    //);

    //return {
    //  ...receipt,
    //  state: TransferState.DestinationInitiated,
    //  destinationTxs: dstTxIds,
    //};
    throw new Error("Method not implemented.");
  }

  async resume(txid: TransactionId): Promise<R> {
    //const xfer = await TokenTransfer.from(this.wh, txid, 10 * 1000);
    //return TokenTransfer.getReceipt(xfer);
    throw new Error("Method not implemented.");
  }

  async *track(receipt: Receipt, timeout?: number) {
    //    yield* TokenTransfer.track(this.wh, receipt, timeout);
    throw new Error("Method not implemented.");
  }

  static async isSourceTokenSupported<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
  ): Promise<boolean> {
    // tbtc minted by threshold is supported
    const tbtcAddr = tbtc.tbtcTokens.get(fromChain.network, fromChain.chain);
    if (tbtcAddr && isSameToken(sourceToken, Wormhole.tokenId(fromChain.chain, tbtcAddr))) {
      return true;
    }

    // wormhole-wrapped ethereum tbtc is supported
    const tb = await fromChain.getTokenBridge();
    const ethTbtc = this.getEthTbtcToken(fromChain.network);
    try {
      const wrappedTbtc = await tb.getWrappedAsset(ethTbtc);
      return isSameToken(sourceToken, Wormhole.tokenId(fromChain.chain, wrappedTbtc.toString()));
    } catch (e: any) {
      if (e.message.includes("not a wrapped asset")) return false;
      throw e;
    }
  }

  static getEthTbtcToken<N extends Network>(network: N): TokenId {
    const chain = network === "Mainnet" ? "Ethereum" : "Sepolia";
    const addr = tbtc.tbtcTokens.get(network, chain)!;
    return Wormhole.tokenId(chain, addr);
  }
}
