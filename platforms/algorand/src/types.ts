import {
  UniversalOrNative,
  PlatformToChains,
} from '@wormhole-foundation/connect-sdk';
import { Transaction } from 'algosdk';

export type AlgorandChainName = PlatformToChains<'Algorand'>;
export type UniversalOrAlgorand = UniversalOrNative<'Algorand'>;
export type AnyAlgorandAddress = UniversalOrAlgorand | string | Uint8Array;

export type Signer = {
  addr: string;
  signTxn(txn: Transaction): Promise<Uint8Array>;
};

export type TransactionSignerPair = {
  tx: Transaction;
  signer: Signer | null;
};
