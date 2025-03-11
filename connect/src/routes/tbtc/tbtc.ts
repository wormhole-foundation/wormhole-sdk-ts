import { Chain, contracts, Network } from "@wormhole-foundation/sdk-base";
import { ManualRoute, StaticRouteMethods } from "../route.js";
import {
  ChainAddress,
  ChainContext,
  Signer,
  TokenId,
  TransactionId,
} from "@wormhole-foundation/sdk-definitions";
import { isSameToken } from "@wormhole-foundation/sdk-definitions";
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
import { Wormhole } from "../../wormhole.js";

type Op = Options;
type Vp = ValidatedTransferParams<Op>;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type QR = QuoteResult<Op, Vp>;
type Q = Quote<Op, Vp>;
type R = TransferReceipt<AttestationReceipt<"TbtcBridge">>;

export class TbtcRoute<N extends Network>
  extends ManualRoute<N>
  implements StaticRouteMethods<typeof TbtcRoute>
{
  static meta = {
    name: "Tbtc",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }

  static supportedChains(network: Network): Chain[] {
    return contracts.tokenBridgeChains(network);
  }

  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    const fromContracts = contracts.tbtcContracts.get(fromChain.network, fromChain.chain);
    const toContracts = contracts.tbtcContracts.get(toChain.network, toChain.chain);
    if (
      fromContracts &&
      isSameToken(sourceToken, Wormhole.tokenId(fromChain.chain, fromContracts.tbtcToken))
    ) {
      if (toContracts) {
        return [Wormhole.tokenId(toChain.chain, toContracts.tbtcToken)];
      }

      const toTokenBridge = await toChain.getTokenBridge();
      try {
        const wrapped = await toTokenBridge.getWrappedAsset(Wormhole.tokenId("Ethereum", ""));
        return [Wormhole.tokenId(toChain.chain, wrapped.toString())];
      } catch (e: any) {
        if (!e.message.includes("not a wrapped asset")) throw e;
        return [];
      }
    }

    const fromTokenBridge = await fromChain.getTokenBridge();
    const original = await fromTokenBridge.getOriginalAsset(sourceToken.address);
    if (isSameToken(original, Wormhole.tokenId("Ethereum", ""))) {
      const toTokenBridge = await toChain.getTokenBridge();
      try {
        const wrapped = await toTokenBridge.getWrappedAsset(Wormhole.tokenId("Ethereum", ""));
        return [Wormhole.tokenId(toChain.chain, wrapped.toString())];
      } catch (e: any) {
        if (!e.message.includes("not a wrapped asset")) throw e;
        return [];
      }
    }

    return [];
  }

  getDefaultOptions(): Op {
    return {};
  }

  async validate(request: RouteTransferRequest<N>, params: Tp): Promise<Vr> {
    // const amt = amount.parse(params.amount, request.source.decimals);

    const validatedParams: ValidatedTransferParams<Options> = {
      amount: params.amount,
      //   normalizedParams: { amount: amt },
      options: {},
    };

    return { valid: true, params: validatedParams };
  }

  async quote(request: RouteTransferRequest<N>, params: Vp): Promise<QR> {
    throw new Error("Method not implemented.");
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

  //private toTransferDetails(
  //  request: RouteTransferRequest<N>,
  //  params: Vp,
  //  from: ChainAddress,
  //  to: ChainAddress,
  //): TokenTransferDetails {
  //  return {
  //    from,
  //    to,
  //    token: request.source.id,
  //    amount: amount.units(params.normalizedParams.amount),
  //    ...params.options,
  //  };
  //}
}
