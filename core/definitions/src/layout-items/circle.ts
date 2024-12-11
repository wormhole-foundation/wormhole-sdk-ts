import type { Layout } from "@wormhole-foundation/sdk-base";

export const circleDomainItem = {
  binary: "uint",
  size: 4,
} as const satisfies Layout;

export const circleNonceItem = {
  binary: "uint",
  size: 8,
} as const;
