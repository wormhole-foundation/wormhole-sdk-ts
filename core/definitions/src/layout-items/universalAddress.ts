import type {
  Layout,
  CustomConversion,
} from "@wormhole-foundation/sdk-base";
import { UniversalAddress } from '../universalAddress.js';

export const universalAddressItem = {
  binary: "bytes",
  size: 32,
  custom: {
    to: (val: Uint8Array): UniversalAddress => new UniversalAddress(val),
    from: (val: UniversalAddress): Uint8Array => val.toUint8Array(),
  } satisfies CustomConversion<Uint8Array, UniversalAddress>,
} as const satisfies Layout;
