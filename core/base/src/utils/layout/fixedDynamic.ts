import {
  Layout,
  LayoutItem,
  ObjectLayoutItem,
  ArrayLayoutItem,
  LayoutToType,
  PrimitiveType,
  FixedConversion,
  isPrimitiveType,
} from "./layout";

type FilterFixedItem<I extends LayoutItem> =
  I extends { custom: PrimitiveType | FixedConversion<PrimitiveType, any> }
  ? I
  : I extends ObjectLayoutItem | ArrayLayoutItem
  ? FixedItemsOfLayout<I["layout"]> extends readonly LayoutItem[]
    ? [FixedItemsOfLayout<I["layout"]>[number]] extends [never]
      ? never
      : { readonly [K in keyof I]: K extends "layout" ? FixedItemsOfLayout<I["layout"]> : I[K] }
    : never
  : never;

export type FixedItemsOfLayout<L extends Layout> =
  L extends readonly [infer H extends LayoutItem, ...infer T]
  ? [FilterFixedItem<H>] extends [never]
    ? T extends Layout
      ? FixedItemsOfLayout<T>
      : readonly []
    : T extends Layout
      ? readonly [FilterFixedItem<H>, ...FixedItemsOfLayout<T>]
      : readonly [FilterFixedItem<H>]
  : readonly [];

export const fixedItemsOfLayout = <L extends Layout>(layout: L): FixedItemsOfLayout<L> =>
  layout.reduce(
    (acc: any, item: any) => {
      if (item["custom"] !== undefined && (
          isPrimitiveType(item["custom"]) || isPrimitiveType(item["custom"].from)
        ))
        return [...acc, item ];
      if (item.binary === "array" || item.binary === "object") {
        const fixedItems = fixedItemsOfLayout(item.layout);
        if (fixedItems.length > 0)
          return [...acc, { ...item, layout: fixedItems }];
      }
      return acc;
    },
    [] as any
  );

type FilterDynamicItem<I extends LayoutItem> =
  I extends { custom: PrimitiveType | FixedConversion<PrimitiveType, any> }
  ? never
  : I extends ObjectLayoutItem | ArrayLayoutItem
  ? DynamicItemsOfLayout<I["layout"]> extends readonly LayoutItem[]
    ? [DynamicItemsOfLayout<I["layout"]>[number]] extends [never]
      ? never
      : { readonly [K in keyof I]: K extends "layout" ? DynamicItemsOfLayout<I["layout"]> : I[K] }
    : never
  : I;

export type DynamicItemsOfLayout<L extends Layout> =
  L extends readonly [infer H extends LayoutItem, ...infer T]
  ? [FilterDynamicItem<H>] extends [never]
    ? T extends Layout
      ? DynamicItemsOfLayout<T>
      : readonly []
    : T extends Layout
      ? readonly [FilterDynamicItem<H>, ...DynamicItemsOfLayout<T>]
      : readonly [FilterDynamicItem<H>]
  : readonly [];

export const dynamicItemsOfLayout = <L extends Layout>(layout: L): DynamicItemsOfLayout<L> =>
  layout.reduce(
    (acc: any, item: any) => {
      if (item["custom"] === undefined || !(
          isPrimitiveType(item["custom"]) || isPrimitiveType(item["custom"].from)
        ))
        return [...acc, item ];
      if (item.binary === "array" || item.binary === "object") {
        const dynamicItems = dynamicItemsOfLayout(item.layout);
        if (dynamicItems.length > 0)
          return [...acc, { ...item, layout: dynamicItems }];
      }
      return acc;
    },
    [] as any
  );

export const addFixedValues = <L extends Layout>(
  layout: L,
  dynamicValues: LayoutToType<DynamicItemsOfLayout<L>>,
): LayoutToType<L> => {
  const ret = {} as any;
  for (const item of layout) {
    if (item.binary === "object") {
      const subDynamicValues = (
        (item.name in dynamicValues)
        ? dynamicValues[item.name as keyof typeof dynamicValues]
        : {}
      ) as LayoutToType<DynamicItemsOfLayout<typeof item.layout>>;
      ret[item.name] = addFixedValues(item.layout, subDynamicValues);
    }
    else if (item.binary === "array") {
      const subDynamicValues = (
        (item.name in dynamicValues)
        ? dynamicValues[item.name as keyof typeof dynamicValues]
        : []
      ) as readonly LayoutToType<DynamicItemsOfLayout<typeof item.layout>>[];
      ret[item.name] = subDynamicValues.map(element => addFixedValues(item.layout, element));
    }
    else if (item.custom !== undefined &&
        (isPrimitiveType(item.custom) || isPrimitiveType((item.custom as {from: any}).from))
      ) {
        if (!(item as {omit?: boolean})?.omit)
          ret[item.name] = isPrimitiveType(item.custom) ? item.custom : item.custom.to;
    }
    else
      ret[item.name] = dynamicValues[item.name as keyof typeof dynamicValues];
  }
  return ret as LayoutToType<L>;
}
