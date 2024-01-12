import { Wormhole } from "../wormhole";

import { ChainAddress, Signer, TokenId, TransactionId } from "@wormhole-foundation/sdk-definitions";

import { Network } from "@wormhole-foundation/sdk-base";
import { UnknownRoute } from "./resolver";

export interface RouteTransferRequest {
  from: ChainAddress;
  to: ChainAddress;
  amount: bigint;
  source: TokenId;
  destination?: TokenId;
}

export type ValidationResult<T, E = Error> = { valid: T } | { valid: false; error: E };

export type ValidationError = "Amount too small" | "Some other error";

export abstract class Route<N extends Network, OP, IR> {
  wh: Wormhole<N>;
  request: RouteTransferRequest;

  abstract readonly NATIVE_GAS_DROPOFF_SUPPORTED: boolean;

  // true means this is a one-transaction route (using a relayer)
  abstract readonly IS_AUTOMATIC: boolean;

  public constructor(wh: Wormhole<N>, request: RouteTransferRequest) {
    this.wh = wh;
    this.request = request;
  }

  public abstract isSupported(): Promise<boolean>;

  public abstract validate(options: OP): Promise<ValidationResult<boolean, ValidationError>>;

  public abstract initiate(sender: Signer, options: OP): Promise<IR>;
}

export abstract class AutomaticRoute<N extends Network, OP, IR> extends Route<N, OP, IR> {
  IS_AUTOMATIC = false;
  public abstract isAvailable(): Promise<boolean>;
}

export function isAutomatic<N extends Network>(
  route: UnknownRoute<N>,
): route is AutomaticRoute<N, unknown, unknown> {
  return (
    (route as AutomaticRoute<N, unknown, unknown>).isAvailable !== undefined && route.IS_AUTOMATIC
  );
}

export abstract class ManualRoute<N extends Network, OP, IR> extends Route<N, OP, IR> {
  NATIVE_GAS_DROPOFF_SUPPORTED = false;
  IS_AUTOMATIC = false;
  public abstract complete(sender: Signer, msg: IR): Promise<TransactionId[]>;
}

export function isCompletable<N extends Network>(
  route: UnknownRoute<N>,
): route is ManualRoute<N, unknown, unknown> {
  return (route as ManualRoute<N, unknown, unknown>).complete !== undefined;
}
