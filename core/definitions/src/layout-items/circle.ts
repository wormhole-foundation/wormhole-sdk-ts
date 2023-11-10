import { CircleChain, circleChainId, toCircleChain } from "@wormhole-foundation/sdk-base";

export const circleDomainItem = {
  binary: "uint",
  size: 4,
  custom: {
    to: (id: number) => toCircleChain(id),
    from: (name: CircleChain) => circleChainId(name),
  },
} as const;

export const circleNonceItem = {
  binary: "uint",
  size: 8,
} as const;
