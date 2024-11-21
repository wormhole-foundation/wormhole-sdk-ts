import type { Layout, CustomConversion } from "@wormhole-foundation/sdk-base";

export const boolItem = {
  binary: "uint",
  size: 1,
  custom: {
    to: (encoded: number): boolean => encoded > 0,
    from: (val: boolean): number => (val ? 1 : 0),
  } satisfies CustomConversion<number, boolean>,
} as const satisfies Layout;
