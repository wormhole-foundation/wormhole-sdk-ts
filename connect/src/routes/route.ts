import {
  Chain,
  ChainAddress,
} from "@wormhole-foundation/sdk-base";

import {
  TokenId,
  Signer,
  TxHash,
} from "@wormhole-foundation/sdk-definitions";

interface TransferRequest
  from: ChainAddress,
  to: ChainAddress,
  source: TokenId;
  destination: TokenId;
  amount: bigint;
}

export type Result<T, E = Error> = { result: T } | { error: E };

export type ValidationError = 'Amount too small' | 'Some other error';

export abstract class Route<OPT> {
  abstract readonly NATIVE_GAS_DROPOFF_SUPPORTED: boolean;

  // true means this is a one-transaction route (using a relayer)
  abstract readonly IS_AUTOMATIC: boolean;

  public constructor(request: TransferRequest): Route {
    this.request = request;
  }

  public abstract isSupported(): Promise<boolean>;

  public abstract isAvailable(): Promise<boolean>;

  public abstract validate(): Result<boolean, ValidationError>;

  public abstract execute(sender: Signer, options: OPT): TxHash[];

}
