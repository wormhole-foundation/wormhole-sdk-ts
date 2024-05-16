import type {
  Layout,
  ProperLayout,
  LayoutItem,
  NumLayoutItem,
  BytesLayoutItem,
  ArrayLayoutItem,
  SwitchLayoutItem,
  LayoutToType,
  NumType,
  BytesType,
  LayoutObject,
  FixedConversion,
  CustomConversion,
} from './layout.js';

import { isPrimitiveType, isLayoutItem, isFixedPrimitiveConversion } from './utils.js';

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

type FilterLayoutOfItem<Item extends { layout: Layout }, Fixed extends boolean> =
  FilterItemsOfLayout<Item["layout"], Fixed> extends infer L extends LayoutItem | NonEmpty
  ? { readonly [K in keyof Item]: K extends "layout" ? L : Item[K] }
  : void;

type FilterItem<Item extends LayoutItem, Fixed extends boolean> =
  Item extends infer I extends LayoutItem
  ? I extends NumLayoutItem
    ? I["custom"] extends NumType | FixedConversion<infer From extends NumType, infer To>
      ? Fixed extends true ? I : void
      : Fixed extends true ? void : I
    : I extends ArrayLayoutItem
    ? FilterLayoutOfItem<I, Fixed>
    : I extends BytesLayoutItem & { layout: Layout }
    ? I["custom"] extends { custom: FixedConversion<infer From extends LayoutObject, infer To>}
      ? Fixed extends true ? I : void
      : I extends { custom: CustomConversion<infer From extends LayoutObject, infer To>}
      ? Fixed extends true ? void : I
      : FilterLayoutOfItem<I, Fixed>
    : I extends BytesLayoutItem
    ? I["custom"] extends BytesType | FixedConversion<infer From extends BytesType, infer To>
      ? Fixed extends true ? I : void
      : Fixed extends true ? void : I
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
  ? P extends readonly [infer H extends LayoutItem, ...infer T extends ProperLayout]
    ? FilterItem<H, Fixed> extends infer NI
      ? NI extends LayoutItem
      // @ts-ignore
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
      if ("layout" in item) {
        const { custom } = item;
        if (custom === undefined) {
          const { layout } = item;
          if (isLayoutItem(layout))
            return filterItem(layout, fixed);

          const filteredItems = internalFilterItemsOfProperLayout(layout, fixed);
          return (filteredItems.length > 0) ? { ...item, layout: filteredItems } : null;
        }
        const isFixedItem = typeof custom.from !== "function";
        return (fixed && isFixedItem || !fixed && !isFixedItem) ? item : null;
      }
    }
    case "int":
    case "uint": {
      const { custom } = item;
      const isFixedItem = isPrimitiveType(custom) || isFixedPrimitiveConversion(custom);
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
      const filtered = filterItem(item, fixed) as ProperLayout[number] | null;
      return filtered !== null ? [...acc, filtered] : acc;
    },
    [] as ProperLayout
  );
}

function internalFilterItemsOfLayout(layout: Layout, fixed: boolean): any {
  return (Array.isArray(layout)
    ? internalFilterItemsOfProperLayout(layout, fixed)
    : filterItem(layout as LayoutItem, fixed)
   );
}

function filterItemsOfLayout<L extends Layout, const Fixed extends boolean>(
  layout: L,
  fixed: Fixed
): FilterItemsOfLayout<L, Fixed> {
  return internalFilterItemsOfLayout(layout, fixed);
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
      if ("layout" in item) {
        const { custom } = item;
        if (custom === undefined || typeof custom.from !== "function")
          return internalAddFixedValues(item.layout, custom ? custom.from : dynamicValue);

        return dynamicValue;
      }
    }
    case "int":
    case "uint": {
      const { custom } = item;
      return (item as {omit?: boolean})?.omit
        ? undefined
        : isPrimitiveType(custom)
        ? custom
        : isFixedPrimitiveConversion(custom)
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

export function addFixedValues<const L extends Layout>(
  layout: L,
  dynamicValues: LayoutToType<DynamicItemsOfLayout<L>>,
): LayoutToType<L> {
  return internalAddFixedValues(layout, dynamicValues) as LayoutToType<L>;
}
