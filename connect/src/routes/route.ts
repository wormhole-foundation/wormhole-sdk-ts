import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import type {
  ChainContext,
  Signer,
  TokenId,
  TransactionId,
} from "@wormhole-foundation/sdk-definitions";
import type { Wormhole } from "../wormhole.js";
import type { RouteTransferRequest } from "./request.js";
import type {
  Options,
  Quote,
  QuoteResult,
  Receipt,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "./types.js";
import type { ChainAddress } from "@wormhole-foundation/sdk-definitions";

export abstract class Route<
  N extends Network,
  OP extends Options = Options,
  VP extends ValidatedTransferParams<OP> = ValidatedTransferParams<OP>,
  R extends Receipt = Receipt,
> {
  wh: Wormhole<N>;

  public constructor(wh: Wormhole<N>) {
    this.wh = wh;
  }

  // Validate the transfer request after applying any options
  // return a quote and suggested options
  public abstract validate(
    request: RouteTransferRequest<N>,
    params: TransferParams<OP>,
  ): Promise<ValidationResult<OP>>;

  // Get a quote for the transfer with the given options
  public abstract quote(
    request: RouteTransferRequest<N>,
    params: ValidatedTransferParams<OP>,
  ): Promise<QuoteResult<OP, VP>>;

  // Initiate the transfer with the transfer request and passed options
  public abstract initiate(
    request: RouteTransferRequest<N>,
    sender: Signer,
    quote: Quote<OP, VP>,
    to: ChainAddress,
  ): Promise<R>;

  // Track the progress of the transfer over time
  public abstract track(receipt: R, timeout?: number): AsyncGenerator<R>;

  // Get the url to view the transfer on the explorer for the route provider
  transferUrl(txid: string): string {
    return `https://wormholescan.io/#/tx/${txid}?network=${this.wh.network}`;
  }

  // Get the default options for this route, useful to pre-populate a form
  public abstract getDefaultOptions(): OP;
}

export interface RouteMeta {
  // Common name for the route,
  //eg "TokenBridge" or "CCTP"
  name: string;
  // Url to logo route provider
  logo?: string;
  // If people have trouble, where should they go?
  support?: string;
  // Github link
  source?: string;
}

export interface RouteConstructor<OP extends Options = Options> {
  new <N extends Network>(wh: Wormhole<N>): Route<N, OP>;
  /**  Details about the route provided by the implementation */
  readonly meta: RouteMeta;
  /** true means this route supports native gas dropoff */
  readonly NATIVE_GAS_DROPOFF_SUPPORTED: boolean;
  /** true means this is a one-transaction route (using a relayer) */
  readonly IS_AUTOMATIC: boolean;
  /** get the list of networks this route supports */
  supportedNetworks(): Network[];
  /** get the list of chains this route supports */
  supportedChains(network: Network): Chain[];
  /** get the list of source tokens that are possible to send */
  supportedSourceTokens(fromChain: ChainContext<Network>): Promise<TokenId[]>;
  /** get the list of destination tokens that may be received on the destination chain */
  supportedDestinationTokens<N extends Network>(
    token: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]>;
}

// Use this to ensure the static methods defined in the RouteConstructor
export type StaticRouteMethods<I extends RouteConstructor> = InstanceType<I>;

/**
 * AutomaticRoute is used whenever a relayer is delivering the
 * Attestation to the destination chain
 */
export abstract class AutomaticRoute<
  N extends Network,
  OP extends Options = Options,
  VP extends ValidatedTransferParams<OP> = ValidatedTransferParams<OP>,
  R extends Receipt = Receipt,
> extends Route<N, OP, VP, R> {
  static IS_AUTOMATIC = true;
}

export function isAutomatic<N extends Network>(route: Route<N>): route is AutomaticRoute<N> {
  return !!(route.constructor as RouteConstructor).IS_AUTOMATIC;
}

/**
 * Manual route is used whenever a manual delivery of the Attestation
 * is necessary
 */
export abstract class ManualRoute<
  N extends Network,
  OP extends Options = Options,
  VP extends ValidatedTransferParams<OP> = ValidatedTransferParams<OP>,
  R extends Receipt = Receipt,
> extends Route<N, OP, VP, R> {
  static NATIVE_GAS_DROPOFF_SUPPORTED = false;
  static IS_AUTOMATIC = false;
  public abstract complete(sender: Signer, receipt: R): Promise<R>;
  public abstract resume(tx: TransactionId): Promise<R>;
}

export function isManual<N extends Network>(route: Route<N>): route is ManualRoute<N> {
  return (route as ManualRoute<N>).complete !== undefined;
}

/**
 * FinalizableRoute is used whenever the route has a step after
 * completion that needs to be done
 */
export abstract class FinalizableRoute<
  N extends Network,
  OP extends Options = Options,
  VP extends ValidatedTransferParams<OP> = ValidatedTransferParams<OP>,
  R extends Receipt = Receipt,
> extends Route<N, OP, VP, R> {
  public abstract finalize(sender: Signer, receipt: R): Promise<R>;
  public abstract resume(tx: TransactionId): Promise<R>;
}

export function isFinalizable<N extends Network>(route: Route<N>): route is FinalizableRoute<N> {
  return (route as FinalizableRoute<N>).finalize !== undefined;
}
