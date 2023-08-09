//TODO this should get properly wrapped and get its own interface so we don't expose implementation
//  internals and can swap out the implementation if we choose to later. Maybe also rename
//  recovery to v then (this seems to be the convention at least in EVM land)

import { Signature as SignatureOptionalRecovery } from "@noble/secp256k1";

export class Signature extends SignatureOptionalRecovery {
  constructor(readonly r: bigint, readonly s: bigint, readonly recovery: number) {
    super(r, s, recovery);
  }
}