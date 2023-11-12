import { circle } from "@wormhole-foundation/sdk-base";

export const circleDomainItem = {
  binary: "uint",
  size: 4,
  custom: {
    to: (id: number) => circle.toCircleChain(id),
    from: (name: circle.CircleChain) => circle.circleChainId(name),
  },
} as const;

export const circleNonceItem = {
  binary: "uint",
  size: 8,
} as const;
