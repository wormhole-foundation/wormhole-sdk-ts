import {
  Layout,
  LayoutItem,
  UintLayoutItem,
  BytesLayoutItem,
  ObjectLayoutItem,
  ArrayLayoutItem,
  SwitchLayoutItem,
  LayoutToType,
  PrimitiveType,
  FixedConversion,
  isPrimitiveType,
} from "./layout";

type IsNever<T> = [T] extends [never] ? true : false;
type IsEmpty<T> =
  IsNever<T> extends false
  ? T extends readonly [unknown, ...unknown[]]
    ? false
    : true
  : true;

type IdLayoutPair = readonly [unknown, Layout];
type FilterItemsOfIdLayoutPairs<ILA extends readonly IdLayoutPair[], Fixed extends boolean> = 
  ILA extends readonly [infer H extends IdLayoutPair, ...infer T extends readonly IdLayoutPair[]]
  ? FilterItemsOfLayout<H[1], Fixed> extends infer L
    ? IsEmpty<L> extends false
      ? [[H[0], L], ...FilterItemsOfIdLayoutPairs<T, Fixed>]
      : FilterItemsOfIdLayoutPairs<T, Fixed>
    : never
  : [];

type FilterItem<I extends LayoutItem, Fixed extends boolean> =
  I extends UintLayoutItem | BytesLayoutItem
  ? I extends { custom: PrimitiveType | FixedConversion<PrimitiveType, any> }
    ? Fixed extends true ? I : never
    : Fixed extends true ? never : I
  : I extends ObjectLayoutItem | ArrayLayoutItem
  ? FilterItemsOfLayout<I["layout"], Fixed> extends infer L
    ? IsEmpty<L> extends false
      ? { readonly [K in keyof I]: K extends "layout" ? L : I[K] }
      : never
    : never
  : I extends SwitchLayoutItem
  ? FilterItemsOfIdLayoutPairs<I["idLayoutPairs"], Fixed> extends infer Narrowed
    ? IsEmpty<Narrowed> extends false
      ? { readonly [K in keyof I]: K extends "idLayoutPairs" ? Narrowed : I[K] }
      : never
    : never
  : never;

type FilterItemsOfLayout<L extends Layout, Fixed extends boolean> =
  L extends readonly [infer H extends LayoutItem, ...infer T extends Layout]
  ? FilterItem<H, Fixed> extends infer I
    ? IsNever<I> extends false
      ? [I, ...FilterItemsOfLayout<T, Fixed>]
      : FilterItemsOfLayout<T, Fixed>
    : never
  : [];

function filterItemsOfLayout<L extends Layout, Fixed extends boolean>(
  layout: L,
  fixed: Fixed
): FilterItemsOfLayout<L, Fixed> {
  return layout.reduce(
    (acc: Layout, item: LayoutItem) => {
      let filtered = null;
      switch (item.binary) {
        case "uint":
        case "bytes": {
          const isFixedItem = item["custom"] !== undefined && (
            isPrimitiveType(item["custom"]) || isPrimitiveType(item["custom"].from)
          );
          if (fixed && isFixedItem || !fixed && !isFixedItem)
            filtered = item;
          break;
        }
        case "array":
        case "object": {
          const filteredItems = filterItemsOfLayout(item.layout, fixed);
          if (filteredItems.length > 0)
            filtered = { ...item, layout: filteredItems };
          break;
        }
        case "switch": {
          const filteredIdLayoutPairs =
            (item.idLayoutPairs as IdLayoutPair[]).reduce(
              (acc: any, [idOrConversionId, idLayout]: any) => {
                const filteredItems = filterItemsOfLayout(idLayout, fixed);
                return filteredItems.length > 0
                  ? [...acc, [idOrConversionId, filteredItems]]
                  : acc;
              },
              [] as any
            );
          if (filteredIdLayoutPairs.length > 0)
            filtered = { ...item, idLayoutPairs: filteredIdLayoutPairs };
          break;
        }
      }
      return filtered !== null ? [...acc, filtered] : acc;
    },
    [] as Layout
  ) as FilterItemsOfLayout<L, Fixed>;
}

export type FixedItemsOfLayout<L extends Layout> = FilterItemsOfLayout<L, true>;
export type DynamicItemsOfLayout<L extends Layout> = FilterItemsOfLayout<L, false>;

export const fixedItemsOfLayout = <L extends Layout>(layout: L): FixedItemsOfLayout<L> =>
  filterItemsOfLayout(layout, true);  

export const dynamicItemsOfLayout = <L extends Layout>(layout: L): DynamicItemsOfLayout<L> =>
  filterItemsOfLayout(layout, false);

export const addFixedValues = <L extends Layout>(
  layout: L,
  dynamicValues: LayoutToType<DynamicItemsOfLayout<L>>,
): LayoutToType<L> => {
  const ret = {} as any;
  for (const item of layout) {
    const fromDynamic = () => dynamicValues[item.name as keyof typeof dynamicValues];
    switch (item.binary) {
      case "uint":
      case "bytes": {
        if (!(item as {omit?: boolean})?.omit)
          ret[item.name] = (item.custom !== undefined &&
              (isPrimitiveType(item.custom) || isPrimitiveType((item.custom as {from: any}).from))
            ) ? (isPrimitiveType(item.custom) ? item.custom : item.custom.to)
              : fromDynamic();
        break;
      }
      case "array": {
        const subDynamicValues = (
          (item.name in dynamicValues) ? fromDynamic() : []
        ) as readonly LayoutToType<DynamicItemsOfLayout<typeof item.layout>>[];
        ret[item.name] = subDynamicValues.map(element => addFixedValues(item.layout, element));
        break;
      }
      case "object": {
        const subDynamicValues = (
          (item.name in dynamicValues) ? fromDynamic() : {}
        ) as LayoutToType<DynamicItemsOfLayout<typeof item.layout>>;
        ret[item.name] = addFixedValues(item.layout, subDynamicValues);
        break;
      }
      case "switch": {
        const id = (fromDynamic() as any)[item.idTag ?? "id"];
        const [_, idLayout] = (item.idLayoutPairs as IdLayoutPair[]).find(([idOrConversionId]) =>
          (Array.isArray(idOrConversionId) ? idOrConversionId[1] : idOrConversionId) == id
        )!;
        ret[item.name] = {
          [item.idTag ?? "id"]: id,
          ...addFixedValues(idLayout, fromDynamic() as any)
        };
        break;
      }
    }
  }
  return ret as LayoutToType<L>;
}
