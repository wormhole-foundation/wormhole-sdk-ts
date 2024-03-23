import { ExampleNativeTokenTransfers as RawExampleNativeTokenTransfers } from './example_native_token_transfers.js';
import { NttQuoter as RawNttQuoter } from './ntt_quoter.js';
import { WormholeGovernance as RawWormholeGovernance } from './wormhole_governance.js';

// @ts-ignore
import ntt from './example_native_token_transfers.json';
// @ts-ignore
import quoter from './ntt_quoter.json';
// @ts-ignore
import governance from './wormhole_governance.json';

// This is a workaround for the fact that the anchor idl doesn't support generics
// yet. This type is used to remove the generics from the idl types.
type OmitGenerics<T> = {
  [P in keyof T]: T[P] extends Record<'generics', any>
    ? never
    : T[P] extends object
      ? OmitGenerics<T[P]>
      : T[P];
};

type NativeTokenTransfer = OmitGenerics<RawExampleNativeTokenTransfers>;
type NttQuoter = OmitGenerics<RawNttQuoter>;
type WormholeGovernance = OmitGenerics<RawWormholeGovernance>;

export const idl = { ntt, quoter, governance };
export type { NativeTokenTransfer, NttQuoter, WormholeGovernance };
