import type {
  Layout,
  LayoutToType,
  CustomConversion,
} from "@wormhole-foundation/sdk-base";
import { Signature } from '../signature.js';

const signatureLayout = [
  { name: "r", binary: "uint", size: 32 },
  { name: "s", binary: "uint", size: 32 },
  { name: "v", binary: "uint", size: 1 },
] as const satisfies Layout;

export const signatureItem = {
  binary: "bytes",
  layout: signatureLayout,
  custom: {
    to: (val: LayoutToType<typeof signatureLayout>) => new Signature(val.r, val.s, val.v),
    from: (val: Signature) => ({ r: val.r, s: val.s, v: val.v }),
  } as const satisfies CustomConversion<LayoutToType<typeof signatureLayout>, Signature>,
} as const satisfies Layout;
