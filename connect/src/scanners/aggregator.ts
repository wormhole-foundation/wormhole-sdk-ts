import type { Scanner } from "./types.js";

// TODO: move to utility types
type FirstParameter<FN extends (...args: any[]) => any> = Parameters<FN>[0];

export interface AggregatedTransactions {}

export class ScannerAggregator<const T extends Scanner[]> {
  private scanners: T;

  constructor(scanners: T) {
    this.scanners = scanners;
  }

  public async getAllTransactions(params: {
    [K in keyof T]: FirstParameter<T[K]["getTransactions"]>;
  }): Promise<AggregatedTransactions> {
    throw new Error("not impl");
  }
}
