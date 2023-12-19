import { circle } from "@wormhole-foundation/sdk-base";
import { UintLayoutItem } from "@wormhole-foundation/sdk-base/dist/cjs";
import { CustomConversion } from "@wormhole-foundation/sdk-base/src";

export const circleDomainItem = {
  binary: "uint",
  size: 4,
  custom: {
    to: (id: number) => circle.toCircleChain(id),
    from: (name: circle.CircleChain) => circle.circleChainId(name),
  } satisfies CustomConversion<number, circle.CircleChain>,
} as const satisfies UintLayoutItem;

export const circleNonceItem = {
  binary: "uint",
  size: 8,
} as const;
