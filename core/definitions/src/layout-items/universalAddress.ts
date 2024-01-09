import {
  CustomConversion,
  FixedSizeBytesLayoutItem,
} from "@wormhole-foundation/sdk-base";
import { UniversalAddress } from "../universalAddress";

export const universalAddressItem = {
  binary: "bytes",
  size: 32,
  custom: {
    to: (val: Uint8Array): UniversalAddress => new UniversalAddress(val),
    from: (val: UniversalAddress): Uint8Array => val.toUint8Array(),
  } satisfies CustomConversion<Uint8Array, UniversalAddress>,
} as const satisfies FixedSizeBytesLayoutItem;
