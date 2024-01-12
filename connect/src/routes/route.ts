import { Wormhole } from "../wormhole";

import {
  TokenId,
  Signer,
  TransactionId,
  ChainAddress,
} from "@wormhole-foundation/sdk-definitions";

import { Network } from "@wormhole-foundation/sdk-base";

export interface TransferRequest {
  from: ChainAddress;
  to: ChainAddress;
  source: TokenId;
  destination: TokenId;
  amount: bigint;
}

export type ValidationResult<T, E = Error> = { valid: T } | { valid: false, error: E };

export type ValidationError = 'Amount too small' | 'Some other error';

export abstract class Route<N extends Network> {
  wh: Wormhole<N>;
  request: TransferRequest;

  abstract readonly NATIVE_GAS_DROPOFF_SUPPORTED: boolean;

  // true means this is a one-transaction route (using a relayer)
  abstract readonly IS_AUTOMATIC: boolean;

  public constructor(wh: Wormhole<N>, request: TransferRequest) {
    this.wh = wh;
    this.request = request;
  }

  public abstract isSupported(): Promise<boolean>;

  public abstract isAvailable(): Promise<boolean>;

  public abstract validate(): Promise<ValidationResult<boolean, ValidationError>>;

  public abstract execute(sender: Signer, options: any): Promise<TransactionId[]>;

}

// --- example:

interface MayanOptions {
  gasdropoff: number;
  slipper: number;
}

export class MayanSwapRoute<N extends Network> extends Route<N> {

  NATIVE_GAS_DROPOFF_SUPPORTED = true;
  IS_AUTOMATIC = true;

  async isSupported(): Promise<boolean> {
    return true
  }

  async isAvailable(): Promise<boolean> {
    return true
  }

  async validate(): Promise<ValidationResult<boolean, ValidationError>> {
    return { valid: true }
  }

  async execute(signer: Signer, options: MayanOptions): Promise<TransactionId[]> {
    return []
  }
}
