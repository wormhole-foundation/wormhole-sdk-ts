import { CustomConversion } from "binary-layout";

export const dateConversion = {
  to: (encoded: bigint) => new Date(Number(encoded * 1000n)),
  from: (decoded: Date) => BigInt(decoded.getTime()) / 1000n,
} as const satisfies CustomConversion<bigint, Date>;
