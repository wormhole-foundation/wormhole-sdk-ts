import { Route, type StaticRouteMethods } from "../route.js";
import { chains, type Chain, type Network } from "@wormhole-foundation/sdk-base";
import type {
  ChainAddress,
  ChainContext,
  GatewayTransferDetails,
  Signer,
  TokenId,
} from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../../wormhole.js";
import type {
  Quote,
  QuoteResult,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types.js";
import { GatewayTransfer } from "../../protocols/index.js";
import { CosmwasmPlatform } from "@wormhole-foundation/sdk-cosmwasm";
import { amount } from "@wormhole-foundation/sdk-base";
import { TokenTransferDetails } from "@wormhole-foundation/sdk-definitions";
import { SourceInitiatedTransferReceipt } from "../../types.js";

export namespace GatewayRoute {
  export type Options = {};

  export type NormalizedParams = {
    amount: amount.Amount;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = GatewayRoute.Options;
type Vp = GatewayRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type QR = QuoteResult<Op, Vp>;
type Q = Quote<Op, Vp>;
// type R = TransferReceipt<AttestationReceipt<"TokenBridge">>;

export class GatewayRoute
  extends Route<N, Op, Vp, R>
  implements StaticRouteMethods<typeof GatewayRoute>
{
  NATIVE_GAS_DROPOFF_SUPPORTED = false;
  // Manual when the source chain is a cosmos chain and the destination chain is not
  // Automatic when the destination chain is a cosmos chain
  IS_AUTOMATIC = false;

  static meta = {
    name: "Gateway",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }

  static supportedChains(network: Network): Chain[] {
    // TODO: any chains not supported?
    return chains;
  }

  static async supportedSourceTokens(fromChain: ChainContext<Network>): Promise<TokenId[]> {
    // TODO: native not supported for ibc transfers
    return Object.values(fromChain.config.tokenMap!).map((td) =>
      Wormhole.tokenId(td.chain, td.address),
    );
  }

  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    throw new Error("Method not implemented.");
    //const wh = new Wormhole<N>(networks[N], [CosmwasmPlatform]);
    //const wc = wh.getChain(GatewayTransfer.chain);
    //try {
    //  return [await GatewayTransfer.lookupDestinationToken(fromChain, toChain, wc, sourceToken)];
    //} catch (e) {
    //  console.error(`Failed to get destination token: ${e}`);
    //  return [];
    //}
  }

  static isProtocolSupported<N extends Network>(chain: ChainContext<N>): boolean {
    // TODO: we need both the source and destination chains to determine if the protocol is supported
    return true;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getDefaultOptions(): Op {
    return {};
  }

  async validate(params: Tp): Promise<Vr> {
    throw new Error("Method not implemented.");
  }

  async quote(params: Vp): Promise<QR> {
    throw new Error("Method not implemented.");
  }

  async initiate(signer: Signer, quote: Q, to: ChainAddress): Promise<R> {
    const { params } = quote;
    const transfer = await GatewayTransfer.destinationOverrides(
      this.request.fromChain,
      this.request.toChain,
      //@ts-ignore
      this.request.gatewayChain,
      this.toTransferDetails(params, Wormhole.chainAddress(signer.chain(), signer.address()), to),
    );
    const txids = await GatewayTransfer
  }

  async complete(signer: Signer, receipt: R): Promise<R> {
    throw new Error("Method not implemented.");
  }

  public override async *track(receipt: R, timeout?: number) {
    throw new Error("Method not implemented.");
  }

  private toTransferDetails(
    params: Vp,
    from: ChainAddress,
    to: ChainAddress,
  ): GatewayTransferDetails {
    return {
      from,
      to,
      token: this.request.source.id,
      amount: amount.units(params.normalizedParams.amount),
      ...params.options,
      // TODO: payload?
    };
  }
}
