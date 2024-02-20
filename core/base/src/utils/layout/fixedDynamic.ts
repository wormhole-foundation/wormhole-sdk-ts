import {
  Layout,
  ProperLayout,
  LayoutItem,
  LayoutItemBase,
  NamedLayoutItem,
  SwitchLayoutItem,
  LayoutToType,
  PrimitiveType,
  FixedConversion,
  isPrimitiveType,
} from "./layout";

import { isLayout, isLayoutItem, isFixedConversion } from "./utils";

type NonEmpty = readonly [unknown, ...unknown[]];

type IPLPair = readonly [any, ProperLayout];

type FilterItemsOfIPLPairs<ILA extends readonly IPLPair[], Fixed extends boolean> =
  ILA extends infer V extends readonly IPLPair[]
  ? V extends readonly [infer H extends IPLPair, ...infer T extends readonly IPLPair[]]
    ? FilterItemsOfLayout<H[1], Fixed> extends infer P extends ProperLayout | void
      ? P extends NonEmpty
        ? [[H[0], P], ...FilterItemsOfIPLPairs<T, Fixed>]
        : FilterItemsOfIPLPairs<T, Fixed>
      : never
    : []
  : never;

type GetLayout<I> =
  I extends { layout: Layout }
  ? I["layout"]
  : I extends { custom: Layout }
  ? I["custom"]
  : never;

type FilterItem<Item extends LayoutItem, Fixed extends boolean> =
  Item extends infer I extends LayoutItem
  ? I extends { custom: PrimitiveType | FixedConversion<infer From extends PrimitiveType, infer To> }
    ? Fixed extends true ? I : void
    : I extends LayoutItemBase<"int" | "uint">
    ? Fixed extends true ? void : I
    : I extends LayoutItemBase<"array"> | (LayoutItemBase<"bytes"> & { custom: LayoutItem | NonEmpty })
    ? FilterItemsOfLayout<GetLayout<I>, Fixed> extends infer L extends Layout | void
      ? L extends LayoutItem | NonEmpty
        ? { readonly [K in keyof I]: K extends "layout" | "custom" ? L : I[K] }
        : void
      : never
    : I extends LayoutItemBase<"bytes">
    ? Fixed extends true ? void : I
    : I extends SwitchLayoutItem
    ? { readonly [K in keyof I]:
        K extends "layouts" ? FilterItemsOfIPLPairs<I["layouts"], Fixed> : I[K]
      }
    : never
  : never;

type FilterItemsOfLayout<L extends Layout, Fixed extends boolean> =
  L extends infer LI extends LayoutItem
  ? FilterItem<LI, Fixed>
  : L extends infer P extends ProperLayout
  ? P extends readonly [infer H extends NamedLayoutItem, ...infer T extends ProperLayout]
    ? FilterItem<H, Fixed> extends infer NI
      ? NI extends NamedLayoutItem
        ? [NI, ...FilterItemsOfLayout<T, Fixed>]
        : FilterItemsOfLayout<T, Fixed>
      : never
    : []
  : never;

type StartFilterItemsOfLayout<L extends Layout, Fixed extends boolean> =
  FilterItemsOfLayout<L, Fixed> extends infer V extends Layout
  ? V
  : never;

function filterItem(item: LayoutItem, fixed: boolean): LayoutItem | null {
  switch (item.binary) {
    // @ts-ignore - fallthrough is intentional
    case "bytes": {
      const { custom } = item;
      if (isLayoutItem(custom)) {
        return filterItem(custom, fixed) ?? null;
      }
      if (isLayout(custom)) {
        const filteredItems = internalFilterItemsOfProperLayout(custom, fixed);
        return (filteredItems.length > 0) ? { ...item, custom: filteredItems } : null;
      }
    }
    case "int":
    case "uint": {
      const { custom } = item;
      const isFixedItem = isPrimitiveType(custom) || isFixedConversion(custom);
      return (fixed && isFixedItem || !fixed && !isFixedItem) ? item : null;
    }
    case "array": {
      const filtered = internalFilterItemsOfLayout(item.layout, fixed);
      return (filtered !== null) ? { ...item, layout: filtered } : null;
    }
    case "switch": {
      const filteredIdLayoutPairs = (item.layouts as readonly any[]).reduce(
        (acc: any, [idOrConversionId, idLayout]: any) => {
          const filteredItems = internalFilterItemsOfProperLayout(idLayout, fixed);
          return filteredItems.length > 0
            ? [...acc, [idOrConversionId, filteredItems]]
            : acc;
        },
        [] as any[]
      );
      return { ...item, layouts: filteredIdLayoutPairs };
    }
  }
}

function internalFilterItemsOfProperLayout(proper: ProperLayout, fixed: boolean): ProperLayout {
  return proper.reduce(
    (acc, item) => {
      const filtered = filterItem(item, fixed) as NamedLayoutItem | null;
      return filtered !== null ? [...acc, filtered] : acc;
    },
    [] as ProperLayout
  );
}

function internalFilterItemsOfLayout(layout: Layout, fixed: boolean): any {
  return (Array.isArray(layout)
    ? internalFilterItemsOfProperLayout(layout, fixed)
    : filterItem(layout as LayoutItem, fixed)
   ) as any;
}

function filterItemsOfLayout<L extends Layout, const Fixed extends boolean>(
  layout: L,
  fixed: Fixed
): FilterItemsOfLayout<L, Fixed> {
  return internalFilterItemsOfLayout(layout, fixed) as any;
}

export type FixedItemsOfLayout<L extends Layout> = StartFilterItemsOfLayout<L, true>;
export type DynamicItemsOfLayout<L extends Layout> = StartFilterItemsOfLayout<L, false>;

export const fixedItemsOfLayout = <L extends Layout>(layout: L) =>
  filterItemsOfLayout(layout, true);

export const dynamicItemsOfLayout = <L extends Layout>(layout: L) =>
  filterItemsOfLayout(layout, false);

function internalAddFixedValuesItem(item: LayoutItem, dynamicValue: any): any {
  switch (item.binary) {
    // @ts-ignore - fallthrough is intentional
    case "bytes": {
      const { custom } = item;
      if (isLayout(custom))
        return internalAddFixedValues(custom, dynamicValue);
    }
    case "int":
    case "uint": {
      const { custom } = item;
      return (item as {omit?: boolean})?.omit
        ? undefined
        : isPrimitiveType(custom)
        ? custom
        : isFixedConversion(custom)
        ? custom.to
        : dynamicValue;
    }
    case "array":
      return Array.isArray(dynamicValue)
        ? dynamicValue.map(element => internalAddFixedValues(item.layout, element))
        : undefined;
    case "switch": {
      const id = dynamicValue[item.idTag ?? "id"];
      const [_, idLayout] = (item.layouts as readonly IPLPair[]).find(([idOrConversionId]) =>
        (Array.isArray(idOrConversionId) ? idOrConversionId[1] : idOrConversionId) == id
      )!;
      return {
        [item.idTag ?? "id"]: id,
        ...internalAddFixedValues(idLayout, dynamicValue)
      };
    }
  }
}

function internalAddFixedValues(layout: Layout, dynamicValues: any): any {
  dynamicValues = dynamicValues ?? {};
  if (isLayoutItem(layout))
    return internalAddFixedValuesItem(layout as LayoutItem, dynamicValues);

  const ret = {} as any;
  for (const item of layout) {
    const fixedVals = internalAddFixedValuesItem(
      item,
      dynamicValues[item.name as keyof typeof dynamicValues] ?? {}
    );
    if (fixedVals !== undefined)
      ret[item.name] = fixedVals;
  }
  return ret;
}

export function addFixedValues<L extends Layout>(
  layout: L,
  dynamicValues: LayoutToType<DynamicItemsOfLayout<L>>,
): LayoutToType<L> {
  return internalAddFixedValues(layout, dynamicValues) as LayoutToType<L>;
}
