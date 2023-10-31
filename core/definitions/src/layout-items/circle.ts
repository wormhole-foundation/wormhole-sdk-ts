import { CircleChainName, circleChainId, toCircleChainName } from "@wormhole-foundation/sdk-base";

export const circleDomainItem = {
  binary: "uint",
  size: 4,
  custom: {
    to: (id: number) => toCircleChainName(id),
    from: (name: CircleChainName) => circleChainId(name),
  },
} as const;

export const circleNonceItem = {
  binary: "uint",
  size: 8,
} as const;
