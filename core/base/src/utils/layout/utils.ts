import {
  Layout,
  LayoutItem,
  SwitchLayoutItem,
  FixedConversion,
  BytesType,
  binaryLiterals,
  isBytesType
} from "./layout";

export const isLayoutItem = (x: any): x is LayoutItem => binaryLiterals.includes(x?.binary);

export const isLayout = (x: any): x is Layout =>
  isLayoutItem(x) || Array.isArray(x) && x.every(isLayoutItem);

const isFixedNumberConversion = (custom: any): custom is FixedConversion<number, any> =>
  typeof custom?.from === "number";

const isFixedBigintConversion = (custom: any): custom is FixedConversion<bigint, any> =>
  typeof custom?.from === "bigint";

export const isFixedUintConversion = (custom: any): custom is
    FixedConversion<number, any> | FixedConversion<bigint, any> =>
  isFixedNumberConversion(custom) || isFixedBigintConversion(custom);

export const isFixedBytesConversion = (custom: any): custom is FixedConversion<BytesType, any> =>
  isBytesType(custom?.from);

export const isFixedConversion = (custom: any): custom is
    FixedConversion<number, any> | FixedConversion<bigint, any> | FixedConversion<BytesType, any> =>
  isFixedUintConversion(custom) || isFixedBytesConversion(custom);

export const checkSize = (layoutSize: number, dataSize: number): number => {
  if (layoutSize !== dataSize)
    throw new Error(`size mismatch: layout size: ${layoutSize}, data size: ${dataSize}`);

  return dataSize;
}

export const checkItemSize = (item: any, dataSize: number): number =>
  ("size" in item && item.size !== undefined) ? checkSize(item.size, dataSize) : dataSize;

export const checkNumEquals = (custom: number | bigint, data: number | bigint): void => {
  if (custom != data)
    throw new Error(`value mismatch: (constant) layout value: ${custom}, data value: ${data}`);
}

export const checkBytesTypeEqual = (custom: BytesType, data: BytesType): void => {
  checkSize(custom.length, data.length);

  for (let i = 0; i < custom.length; ++i)
    if (custom[i] !== data[i])
      throw new Error(`binary data mismatch: layout value: ${custom}, data value: ${data}`);
}

export function findIdLayoutPair(item: SwitchLayoutItem, data: any) {
  const id = data[item.idTag ?? "id"];
  return (item.layouts as readonly any[]).find(([idOrConversionId]) =>
    (Array.isArray(idOrConversionId) ? idOrConversionId[1] : idOrConversionId) == id
  )!;
}
