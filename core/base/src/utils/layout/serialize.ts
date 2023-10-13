import {
  Layout,
  LayoutItem,
  LayoutToType,
  LayoutItemToType,
  FixedSizeBytesLayoutItem,
  LengthPrefixedBytesLayoutItem,
  FixedPrimitiveBytesLayoutItem,
  FixedValueBytesLayoutItem,
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

const calcLayoutSize = (
  layout: Layout,
  data: LayoutToType<typeof layout>
): number =>
  layout.reduce((acc: number, item: LayoutItem) => {
    switch (item.binary) {
      case "object": {
        return acc + calcLayoutSize(item.layout, data[item.name] as LayoutItemToType<typeof item>)
      }
      case "array": {
        if (item.lengthSize !== undefined)
          acc += item.lengthSize;

        const narrowedData = data[item.name] as LayoutItemToType<typeof item>;
        for (let i = 0; i < narrowedData.length; ++i)
          acc += calcLayoutSize(item.layout, narrowedData[i]);

        return acc;
      }
      case "bytes": {
        if (isBytesType(item.custom))
          return acc + item.custom.length;

        if (isBytesType(item?.custom?.from))
          return acc + item!.custom!.from.length;

        item = item as FixedSizeBytesLayoutItem | LengthPrefixedBytesLayoutItem;

        if ("size" in item && item.size !== undefined)
          return acc + item.size;

        if (item.lengthSize !== undefined)
          acc += item.lengthSize;

        return acc + (
          (item.custom !== undefined)
          ? item.custom.from(data[item.name])
          : (data[item.name] as LayoutItemToType<typeof item>)
        ).length;
      }
      case "uint": {
        return acc + item.size;
      }
    }
  },
  0
  );

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
  item: LayoutItem,
  data: any,
  encoded: Uint8Array,
  offset: number
): number {
  try {
    switch (item.binary) {
      case "object": {
        for (const i of item.layout)
          offset = serializeLayoutItem(i, data[i.name], encoded, offset);

        break;
      }
      case "array": {
        if (item.lengthSize !== undefined)
          offset = serializeUint(encoded, offset, data.length, item.lengthSize);

        for (let i = 0; i < data.length; ++i)
          offset = serializeLayout(item.layout, data[i], encoded, offset);

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
