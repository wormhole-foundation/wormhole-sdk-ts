import { Network, ProtocolName } from "@wormhole-foundation/sdk-base";
import { ChainAddress, Signer, TokenId, TransactionId } from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../wormhole";
import { TransferQuote, TransferReceipt } from "../wormholeTransfer";
import { UnknownRoute } from "./resolver";

export interface RouteTransferRequest {
  from: ChainAddress;
  to: ChainAddress;
  amount: bigint;
  source: TokenId | "native";
  destination?: TokenId | "native";
}

export type ValidationResult<E = Error> = { valid: true } | { valid: false; error: E };

// OP - Options passed to the route
export abstract class Route<N extends Network, OP> {
  wh: Wormhole<N>;
  request: RouteTransferRequest;

  // true means this route supports native gas dropoff
  abstract readonly NATIVE_GAS_DROPOFF_SUPPORTED: boolean;
  // true means this is a one-transaction route (using a relayer)
  abstract readonly IS_AUTOMATIC: boolean;

  public constructor(wh: Wormhole<N>, request: RouteTransferRequest) {
    this.wh = wh;
    this.request = request;
  }

  // Check if this route is supported for the given transfer request
  public abstract isSupported(): Promise<boolean>;
  // Validte the transfer request after applying any options
  public abstract validate(options: OP): Promise<ValidationResult<Error>>;
  // Initiate the transfer with the transfer request and passed options
  public abstract initiate(sender: Signer, options: OP): Promise<TransferReceipt<ProtocolName>>;
  // Get the default options for this route, useful to prepopulate a form
  public abstract getDefaultOptions(): OP;
  // Get a quote for the transfer with the given options
  public abstract quote(options: OP): Promise<TransferQuote>;
  // Track the progress of the transfer over time
  public abstract track(
    receipt: TransferReceipt<ProtocolName>,
  ): AsyncGenerator<TransferReceipt<ProtocolName>, unknown, unknown>;
}

export abstract class AutomaticRoute<N extends Network, OP> extends Route<N, OP> {
  IS_AUTOMATIC = true;
  public abstract isAvailable(): Promise<boolean>;
}

export function isAutomatic<N extends Network>(
  route: UnknownRoute<N>,
): route is AutomaticRoute<N, unknown> {
  return (route as AutomaticRoute<N, unknown>).isAvailable !== undefined && route.IS_AUTOMATIC;
}

export abstract class ManualRoute<N extends Network, OP> extends Route<N, OP> {
  NATIVE_GAS_DROPOFF_SUPPORTED = false;
  IS_AUTOMATIC = false;
  public abstract complete(
    sender: Signer,
    receipt: TransferReceipt<ProtocolName>,
  ): Promise<TransactionId[]>;
}

export function isCompletable<N extends Network>(
  route: UnknownRoute<N>,
): route is ManualRoute<N, unknown> {
  return (route as ManualRoute<N, unknown>).complete !== undefined;
}
