import { Chain, Network } from "@wormhole-foundation/sdk-base";
import { ChainContext, Signer, TokenId, TransactionId } from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../wormhole";
import { RouteTransferRequest } from "./request";
import {
  Options,
  Quote,
  Receipt,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "./types";

export abstract class Route<
  N extends Network,
  OP extends Options = Options,
  R extends Receipt = Receipt,
  Q extends Quote = Quote,
> {
  wh: Wormhole<N>;
  request: RouteTransferRequest<N>;

  // true means this route supports native gas dropoff
  abstract readonly NATIVE_GAS_DROPOFF_SUPPORTED: boolean;
  // true means this is a one-transaction route (using a relayer)
  abstract readonly IS_AUTOMATIC: boolean;

  public constructor(wh: Wormhole<N>, request: RouteTransferRequest<N>) {
    this.wh = wh;
    this.request = request;
  }

  // Validate the transfer request after applying any options
  // return a quote and suggested options
  public abstract validate(params: TransferParams<OP>): Promise<ValidationResult<OP>>;

  // Initiate the transfer with the transfer request and passed options
  public abstract initiate(sender: Signer, params: ValidatedTransferParams<OP>): Promise<R>;

  // Get a quote for the transfer with the given options
  public abstract quote(params: ValidatedTransferParams<OP>): Promise<Q>;

  // Track the progress of the transfer over time
  public abstract track(receipt: R, timeout?: number): AsyncGenerator<R>;

  // Get the default options for this route, useful to prepopulate a form
  public abstract getDefaultOptions(): OP;
}

export interface RouteMeta {
  // Common name for the route,
  //eg "Wormhole Token Bridge" or "CCTP"
  name: string;
  // Url to logo route provider
  logo?: string;
}

export interface RouteConstructor {
  new <N extends Network>(wh: Wormhole<N>, request: RouteTransferRequest<N>): Route<N>;
  // Details about the route provided by the implementation
  readonly meta?: RouteMeta;
  // get the list of networks this route supports
  supportedNetworks(): Network[];
  // get the list of chains this route supports
  supportedChains(network: Network): Chain[];
  // get the list of source tokens that are possible to send
  supportedSourceTokens(fromChain: ChainContext<Network>): Promise<(TokenId | "native")[]>;
  // get the list of destination tokens that may be recieved on the destination chain
  supportedDestinationTokens<N extends Network>(
    token: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<(TokenId | "native")[]>;
  isProtocolSupported<N extends Network>(
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): boolean;
}

// Use this to ensure the static methods defined in the RouteConstructor
export type StaticRouteMethods<I extends RouteConstructor> = InstanceType<I>;

export abstract class AutomaticRoute<
  N extends Network,
  OP extends Options = Options,
  R extends Receipt = Receipt,
  Q extends Quote = Quote,
> extends Route<N, OP, R, Q> {
  IS_AUTOMATIC = true;
  public abstract isAvailable(): Promise<boolean>;
}

export function isAutomatic<N extends Network>(route: Route<N>): route is AutomaticRoute<N> {
  return (route as AutomaticRoute<N>).isAvailable !== undefined && route.IS_AUTOMATIC;
}

export abstract class ManualRoute<
  N extends Network,
  OP extends Options = Options,
  R extends Receipt = Receipt,
  Q extends Quote = Quote,
> extends Route<N, OP, R, Q> {
  NATIVE_GAS_DROPOFF_SUPPORTED = false;
  IS_AUTOMATIC = false;
  public abstract complete(sender: Signer, receipt: R): Promise<TransactionId[]>;
}

export function isManual<N extends Network>(route: Route<N>): route is ManualRoute<N> {
  return (route as ManualRoute<N>).complete !== undefined;
}
