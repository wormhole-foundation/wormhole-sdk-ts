import { AutomaticRoute, Route, type StaticRouteMethods } from "../route.js";
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
  Receipt,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types.js";
import { GatewayTransfer } from "../../protocols/index.js";
import { CosmwasmPlatform } from "@wormhole-foundation/sdk-cosmwasm";
import { amount } from "@wormhole-foundation/sdk-base";
import { TokenTransferDetails } from "@wormhole-foundation/sdk-definitions";
import { AttestationReceipt, SourceInitiatedTransferReceipt, TransferState } from "../../types.js";

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
// type R = Receipt<AttestationReceipt<"AutomaticGatewayR">>;

export class AutomaticGatewayRoute<N extends Network>
  extends AutomaticRoute<N, Op, Vp, R>
  implements StaticRouteMethods<typeof AutomaticGatewayRoute>
{
  NATIVE_GAS_DROPOFF_SUPPORTED = false;

  static meta = {
    name: "AutomaticGateway",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }

  static supportedChains(network: Network): Chain[] {
    // TODO: return cosmos chains only?
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
    //https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/connect/src/routes/resolver.ts#L59
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
    // send to wormchain, recipient is the token translator contract
    // should pass in a payload that contains the chain id and recipient
    const transfer = await GatewayTransfer.destinationOverrides(
      this.request.fromChain,
      this.request.toChain,
      this.wh.getChain("Wormchain"),
      this.toTransferDetails(params, Wormhole.chainAddress(signer.chain(), signer.address()), to),
    );
    const txids = await GatewayTransfer.transfer<N>(this.request.fromChain, transfer, signer);
    const msg = await GatewayTransfer.getTransferMessage(
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
