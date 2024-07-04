import type { Chain, LayoutItem, MapLevel, Network } from "@wormhole-foundation/sdk-base";
import type { EmptyPlatformMap } from "../../protocol.js";

import { constMap } from "@wormhole-foundation/sdk-base";
import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface ProtocolToInterfaceMapping<N, C> {
      GlobalAccountant: GlobalAccountant<N, C>;
    }
    interface ProtocolToPlatformMapping {
      GlobalAccountant: EmptyPlatformMap<"GlobalAccountant">;
    }
  }
}

export type ModificationKind = "Add" | "Subtract" | "Unknown";
export type ModificationKindEnum = 1 | 2 | 3;

export const modificationKinds = [
  [ "Add", 1 ],
  [ "Subtract", 2 ],
  [ "Unknown", 3 ],
] as const satisfies MapLevel<ModificationKind, ModificationKindEnum>;

export const modificationKindToEnum = constMap(modificationKinds);
export const enumToModificationKind = constMap(modificationKinds, [1, 0]);

export const accountantModificationKindLayoutItem = {
  binary: "uint",
  size: 1,
  custom: {
    to: (val: number) => enumToModificationKind(val as ModificationKindEnum),
    from: (val: ModificationKind) => modificationKindToEnum(val)
  }
} as const satisfies LayoutItem;

export interface GlobalAccountant<N extends Network = Network, C extends Chain = Chain> {
}
