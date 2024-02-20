import {
  Layout,
  LayoutItem,
  LayoutToType,
  isBytesType,

} from "./layout";
import {
  findIdLayoutPair,
  isLayout,
  isLayoutItem,
  isFixedBytesConversion,
  checkItemSize,
} from "./utils";

function calcItemSize(item: LayoutItem, data: any): number | null {
  switch (item.binary) {
    case "int":
    case "uint":
      return item.size;
    case "bytes": {
      const lengthSize = ("lengthSize" in item) ? item.lengthSize | 0 : 0;

      const { custom } = item;
      if (isBytesType(custom))
        return lengthSize + custom.length;

      if (isFixedBytesConversion(custom))
        return lengthSize + custom.from.length;

      if (isLayout(custom)) {
        const layoutSize = internalCalcLayoutSize(custom, data);
        if (layoutSize === null)
          return null;

        return lengthSize + checkItemSize(item, layoutSize);
      }

      if (custom === undefined)
        return data ? lengthSize + checkItemSize(item, data.length) : null;

      return data !== undefined ? lengthSize + checkItemSize(item, custom.from(data).length) : null;
    }
    case "array": {
      const length = "length" in item ? item.length : undefined;
      if (data === undefined) {
        if (length !== undefined) {
          const layoutSize = internalCalcLayoutSize(item.layout);
          if (layoutSize === null)
            return null;

          return length * layoutSize;
        }
        return null;
      }

      const narrowedData = data as LayoutToType<typeof item>;

      let size = 0;
      if (length !== undefined && length !== narrowedData.length)
        throw new Error(
          `array length mismatch: layout length: ${length}, data length: ${narrowedData.length}`
        );
      else if ("lengthSize" in item && item.lengthSize !== undefined)
        size += item.lengthSize;

      for (let i = 0; i < narrowedData.length; ++i) {
        const entrySize = internalCalcLayoutSize(item.layout, narrowedData[i]);
        if (entrySize === null)
          return null;

        size += entrySize;
      }

      return size;
    }
    case "switch": {
      if (data !== undefined) {
        const [_, layout] = findIdLayoutPair(item, data);
        const layoutSize = internalCalcLayoutSize(layout, data);
        return layoutSize !== null ? item.idSize + layoutSize : null;
      }

      let size = null;
      for (const [_, layout] of item.layouts) {
        const layoutSize = internalCalcLayoutSize(layout);
        if (size === null)
          size = layoutSize;
        else if (layoutSize !== size)
          return null;
      }
      return item.idSize + size!;
    }
  }
}

function internalCalcLayoutSize(layout: Layout, data?: any): number | null {
  if (isLayoutItem(layout))
    return calcItemSize(layout as LayoutItem, data);

  let size = 0;
  for (const item of layout) {
    let itemData;
    if (data)
      if (!("omit" in item) || !item.omit) {
        if (!(item.name in data))
          throw new Error(`missing data for layout item: ${item.name}`);

        itemData = data[item.name];
      }

    const itemSize = calcItemSize(item, itemData);
    if (itemSize === null) {
      if (data !== undefined)
        throw new Error(`coding error: couldn't calculate size for layout item: ${item.name}`);

      return null;
    }
    size += itemSize;
  }
  return size;
}

//no way to use overloading here:
// export function calcLayoutSize<const L extends Layout>(layout: L): number | null;
// export function calcLayoutSize<const L extends Layout>(layout: L, data: LayoutToType<L>): number;
// export function calcLayoutSize<const L extends Layout>(
//   layout: L,
//   data?: LayoutToType<L>
// ): number | null; //impl
//results in "instantiation too deep" error.
//
//Trying to pack everything into a single function definition means we either can't narrow the
//  return type correctly:
// export function calcLayoutSize<const L extends Layout>(
//   layout: L,
//   data: LayoutToType<L>,
// ): number | null;
//or we have to make data overly permissive via:
// export function calcLayoutSize<
//   const L extends Layout,
//   const D extends LayoutToType<L> | undefined,
//  >(
//   layout: L,
//   data?: D, //data can now contain additional properties
// ): undefined extends D ? number | null : number;
//so we're stuck with having to use to separate names
export function calcStaticLayoutSize(layout: Layout): number | null {
  return internalCalcLayoutSize(layout);
}

export function calcLayoutSize<const L extends Layout>(layout: L, data: LayoutToType<L>): number {
  const size = internalCalcLayoutSize(layout, data);
  if (size === null)
    throw new Error(
      `coding error: couldn't calculate layout size for layout ${layout} with data ${data}`
    );

  return size;
}
