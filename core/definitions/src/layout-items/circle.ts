import type { UintLayoutItem } from "@wormhole-foundation/sdk-base";

export const circleDomainItem = {
  binary: "uint",
  size: 4,
} as const satisfies UintLayoutItem;

export const circleNonceItem = {
  binary: "uint",
  size: 8,
} as const;
