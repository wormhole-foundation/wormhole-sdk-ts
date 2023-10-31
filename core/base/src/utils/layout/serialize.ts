import {
  Layout,
  LayoutItem,
  NamedLayoutItem,
  LayoutToType,
  LayoutItemToType,
  FixedPrimitiveBytesLayoutItem,
  FixedValueBytesLayoutItem,
  SwitchLayoutItem,
  CustomConversion,
  UintType,
  isUintType,
  isBytesType,
  numberMaxSize,
} from "./layout";
import { checkUint8ArrayDeeplyEqual, checkUint8ArraySize, checkUintEquals } from "./utils";

export function serializeLayout<const L extends Layout>(
  layout: L,
  data: LayoutToType<L>,
): Uint8Array;

export function serializeLayout<const L extends Layout>(
  layout: L,
  data: LayoutToType<L>,
  encoded: Uint8Array,
  offset?: number,
): number;

export function serializeLayout<const L extends Layout>(
  layout: L,
  data: LayoutToType<L>,
  encoded?: Uint8Array,
  offset = 0,
): Uint8Array | number {
  let ret = encoded ?? new Uint8Array(calcLayoutSize(layout, data));
  for (let i = 0; i < layout.length; ++i)
    offset = serializeLayoutItem(layout[i], data[layout[i].name as keyof typeof data], ret, offset);

  return encoded === undefined ? ret : offset;
}

const findIdLayoutPair = (item: SwitchLayoutItem, data: any) => {
  const id = data[item.idTag ?? "id"];
  return (item.idLayoutPairs as any[]).find(([idOrConversionId]) =>
    (Array.isArray(idOrConversionId) ? idOrConversionId[1] : idOrConversionId) == id
  )!;
}

const withIgnoredName = (item: LayoutItem) => ({ ...item, name: "ignored" });

const calcItemSize = (item: NamedLayoutItem, data: any) => {
  switch (item.binary) {
    case "uint": {
      return item.size;
    }
    case "bytes": {
      if (isBytesType(item.custom))
        return item.custom.length;

      if (isBytesType(item?.custom?.from))
        return item!.custom!.from.length;

      if ("size" in item && item.size !== undefined)
        return item.size;

      let size = 0;
      if ((item as { lengthSize?: number })?.lengthSize !== undefined)
        size += (item as { lengthSize: number }).lengthSize;

      return size + (
        (item.custom !== undefined)
        ? item.custom.from(data)
        : (data as LayoutItemToType<typeof item>)
      ).length;
    }
    case "array": {
      let size = 0;
      if (item.lengthSize !== undefined)
        size += item.lengthSize;

      const narrowedData = data as LayoutItemToType<typeof item>;
      for (let i = 0; i < narrowedData.length; ++i)
        size += calcItemSize(withIgnoredName(item.arrayItem), narrowedData[i]);

      return size;
    }
    case "object": {
      return calcLayoutSize(item.layout, data as LayoutItemToType<typeof item>)
    }
    case "switch": {
      const [_, layout] = findIdLayoutPair(item, data);
      return item.idSize + calcLayoutSize(layout, data);
    }
  }
}

const calcLayoutSize = (
  layout: Layout,
  data: LayoutToType<typeof layout>
): number =>
  layout.reduce((acc: number, item: NamedLayoutItem) =>
    acc + calcItemSize(item, data[item.name]), 0);

//Wormhole uses big endian by default for all uints
//endianess can be easily added to UintLayout items if necessary
export function serializeUint(
  encoded: Uint8Array,
  offset: number,
  val: UintType,
  bytes: number,
): number {
  if (val < 0 || (typeof val === "number" && !Number.isInteger(val)))
    throw new Error(`Value ${val} is not an unsigned integer`);

  if (bytes > numberMaxSize && typeof val === "number" && val >= 2**(numberMaxSize * 8))
    throw new Error(`Value ${val} is too large to be safely converted into an integer`);

  if (val >= 2n ** BigInt(bytes * 8))
    throw new Error(`Value ${val} is too large for ${bytes} bytes`);

  //big endian byte order
  for (let i = 0; i < bytes; ++i)
    encoded[offset + i] = Number((BigInt(val) >> BigInt(8*(bytes-i-1)) & 0xffn));

  return offset + bytes;
}

function serializeLayoutItem(
  item: NamedLayoutItem,
  data: any,
  encoded: Uint8Array,
  offset: number
): number {
  try {
    switch (item.binary) {
      case "switch": {
        const [idOrConversionId, layout] = findIdLayoutPair(item, data);
        const idNum = (Array.isArray(idOrConversionId) ? idOrConversionId[0] : idOrConversionId);
        offset = serializeUint(encoded, offset, idNum, item.idSize);
        offset = serializeLayout(layout, data, encoded, offset);
        break;
      }
      case "object": {
        offset = serializeLayout(item.layout, data, encoded, offset);
        break;
      }
      case "array": {
        if (item.lengthSize !== undefined)
          offset = serializeUint(encoded, offset, data.length, item.lengthSize);

        for (let i = 0; i < data.length; ++i)
          offset = serializeLayoutItem(withIgnoredName(item.arrayItem), data[i], encoded, offset);

        break;
      }
      case "bytes": {
        const value = (() => {
          if (isBytesType(item.custom)) {
            if (!(item as { omit?: boolean })?.omit)
              checkUint8ArrayDeeplyEqual(item.custom, data);
            return item.custom;
          }

          if (isBytesType(item?.custom?.from))
            //no proper way to deeply check equality of item.custom.to and data in JS
            return item!.custom!.from;

          item = item as
            Exclude<typeof item, FixedPrimitiveBytesLayoutItem | FixedValueBytesLayoutItem>;
          const ret = item.custom !== undefined ? item.custom.from(data) : data;
          if ("size" in item && item.size !== undefined)
            checkUint8ArraySize(ret, item.size);
          else if (item.lengthSize !== undefined)
            offset = serializeUint(encoded, offset, ret.length, item.lengthSize);

          return ret;
        })();

        encoded.set(value, offset);
        offset += value.length;
        break;
      }
      case "uint": {
        const value = (() => {
          if (isUintType(item.custom)) {
            if (!(item as { omit?: boolean })?.omit)
              checkUintEquals(item.custom, data);
            return item.custom;
          }

          if (isUintType(item?.custom?.from))
            //no proper way to deeply check equality of item.custom.to and data in JS
            return item!.custom!.from;

          type narrowedCustom = CustomConversion<number, any> | CustomConversion<bigint, any>;
          return item.custom !== undefined ? (item.custom as narrowedCustom).from(data) : data;
        })();

        offset = serializeUint(encoded, offset, value, item.size);
        break;
      }
    }
  }
  catch (e) {
    (e as Error).message = `when serializing item '${item.name}': ${(e as Error).message}`;
    throw e;
  }
  return offset;
};
