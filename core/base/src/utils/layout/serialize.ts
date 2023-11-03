import {
  Endianness,
  Layout,
  LayoutItem,
  LayoutToType,
  FixedPrimitiveBytesLayoutItem,
  FixedValueBytesLayoutItem,
  CustomConversion,
  NumType,
  isNumType,
  isBytesType,
  numberMaxSize,
} from "./layout";
import { calcLayoutSize } from "./size";
import {
  checkUint8ArrayDeeplyEqual,
  checkUint8ArraySize,
  checkNumEquals,
  findIdLayoutPair
} from "./utils";

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
    try {
      offset =
        serializeLayoutItem(layout[i], data[layout[i].name as keyof typeof data], ret, offset);
    }
    catch (e: any) {
      e.message = `when serializing item '${layout[i].name}': ${e.message}`;
      throw e;
    }

  return encoded === undefined ? ret : offset;
}

//see numberMaxSize comment in layout.ts
const maxAllowedNumberVal = 2 ** (numberMaxSize * 8);

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
      Number((BigInt(val) >> BigInt(8 * (endianness === "big" ? bytes - i - 1 : i)) & 0xffn));

  return offset + bytes;
}

function serializeLayoutItem(
  item: LayoutItem,
  data: any,
  encoded: Uint8Array,
  offset: number
): number {
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
          if (!("omit" in item && item.omit))
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
        else if ("lengthSize" in item && item.lengthSize !== undefined)
          offset =
            serializeNum(encoded, offset, ret.length, item.lengthSize, item.lengthEndianness);

        return ret;
      })();

      encoded.set(value, offset);
      offset += value.length;
      break;
    }
    case "array": {
      if ("length" in item && item.length !== data.length)
        throw new Error(
          `array length mismatch: layout length: ${item.length}, data length: ${data.length}`
        );

      if ("lengthSize" in item && item.lengthSize !== undefined)
        offset =
          serializeNum(encoded, offset, data.length, item.lengthSize, item.lengthEndianness);

      for (let i = 0; i < data.length; ++i)
        offset = serializeLayoutItem(item.arrayItem, data[i], encoded, offset);

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
  return offset;
};
