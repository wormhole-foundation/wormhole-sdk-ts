import {
  Endianness,
  Layout,
  LayoutItem,
  NamedLayoutItem,
  LayoutToType,
  LayoutItemToType,
  FixedPrimitiveBytesLayoutItem,
  FixedValueBytesLayoutItem,
  SwitchLayoutItem,
  CustomConversion,
  NumType,
  isNumType,
  isBytesType,
  numberMaxSize,
} from "./layout";
import { checkUint8ArrayDeeplyEqual, checkUint8ArraySize, checkNumEquals } from "./utils";

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
    case "int":
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


//see numberMaxSize comment in layout.ts
const maxAllowedNumberVal = 2**(numberMaxSize * 8);

export function serializeNum(
  encoded: Uint8Array,
  offset: number,
  val: NumType,
  bytes: number,
  endianness: Endianness = "big",
  signed: boolean = false,
): number {
  if (!signed && val < 0)
    throw new Error(`Value ${val} is negative but unsigned`);

  if (typeof val === "number") {
    if (!Number.isInteger(val))
      throw new Error(`Value ${val} is not an integer`);

    if (bytes > numberMaxSize) {
      if (val >= maxAllowedNumberVal)
        throw new Error(`Value ${val} is too large to be safely converted into an integer`);

      if (signed && val <= -maxAllowedNumberVal)
        throw new Error(`Value ${val} is too small to be safely converted into an integer`);
    }
  }

  const bound = 2n ** BigInt(bytes * 8)
  if (val >= bound)
    throw new Error(`Value ${val} is too large for ${bytes} bytes`);

  if (signed && val < -bound)
    throw new Error(`Value ${val} is too small for ${bytes} bytes`);

  //correctly handles both signed and unsigned values
  for (let i = 0; i < bytes; ++i)
    encoded[offset + i] =
      Number((BigInt(val) >> BigInt(8*(endianness === "big" ? bytes-i-1 : i)) & 0xffn));

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
      case "int":
      case "uint": {
        const value = (() => {
          if (isNumType(item.custom)) {
            if (!(item as { omit?: boolean })?.omit)
              checkNumEquals(item.custom, data);
            return item.custom;
          }

          if (isNumType(item?.custom?.from))
            //no proper way to deeply check equality of item.custom.to and data in JS
            return item!.custom!.from;

          type narrowedCustom = CustomConversion<number, any> | CustomConversion<bigint, any>;
          return item.custom !== undefined ? (item.custom as narrowedCustom).from(data) : data;
        })();

        offset =
          serializeNum(encoded, offset, value, item.size, item.endianness, item.binary === "int");
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
            offset =
              serializeNum(encoded, offset, ret.length, item.lengthSize, item.lengthEndianness);

          return ret;
        })();

        encoded.set(value, offset);
        offset += value.length;
        break;
      }
      case "array": {
        if (item.lengthSize !== undefined)
          offset =
            serializeNum(encoded, offset, data.length, item.lengthSize, item.lengthEndianness);

        for (let i = 0; i < data.length; ++i)
          offset = serializeLayoutItem(withIgnoredName(item.arrayItem), data[i], encoded, offset);

        break;
      }
      case "object": {
        offset = serializeLayout(item.layout, data, encoded, offset);
        break;
      }
      case "switch": {
        const [idOrConversionId, layout] = findIdLayoutPair(item, data);
        const idNum = (Array.isArray(idOrConversionId) ? idOrConversionId[0] : idOrConversionId);
        offset = serializeNum(encoded, offset, idNum, item.idSize, item.idEndianness);
        offset = serializeLayout(layout, data, encoded, offset);
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
