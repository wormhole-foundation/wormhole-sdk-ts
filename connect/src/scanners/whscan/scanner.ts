import { Scanner, type ScannerResult } from "../types.js";

// Transaction history filter parameters
export interface WHScannerFilter {
  routeName?: string;
}

// General Scanner parameters
export interface WHScannerParams {
  address: string;
  page: number;
  pageSize: number;
  filter?: WHScannerFilter;
}

export class WHScanner extends Scanner {
  private apiUrl: string;

  constructor(apiUrl: string) {
    super();

    this.apiUrl = apiUrl;
  }

  public override getTransactions(params: WHScannerParams): Promise<ScannerResult> {
    // TODO: Implement this method
    throw new Error("Not Implemented!");
  }
}
