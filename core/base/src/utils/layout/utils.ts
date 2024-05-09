import type {
  Layout,
  LayoutItem,
  BytesLayoutItem,
  SwitchLayoutItem,
  FixedConversion,
  CustomConversion,
  NumType,
  BytesType,
  PrimitiveType
} from "./layout.js";
import { binaryLiterals } from "./layout.js";

export const isNumType = (x: any): x is NumType =>
  typeof x === "number" || typeof x === "bigint";

export const isBytesType = (x: any): x is BytesType => x instanceof Uint8Array;

export const isPrimitiveType = (x: any): x is PrimitiveType =>
  isNumType(x) || isBytesType(x);

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

export const isFixedPrimitiveConversion = (custom: any): custom is
    FixedConversion<number, any> | FixedConversion<bigint, any> | FixedConversion<BytesType, any> =>
  isFixedUintConversion(custom) || isFixedBytesConversion(custom);

export type CustomizableBytes =
  undefined |
  Layout |
  Uint8Array |
  FixedConversion<Uint8Array, any> |
  CustomConversion<Uint8Array, any> |
  readonly [Layout, FixedConversion<any, any> | CustomConversion<any, any>];

type CombineObjects<T, U> = {
  [K in keyof T | keyof U]: K extends keyof T ? T[K] : K extends keyof U ? U[K] : never;
};

export type BytesBase =
  Partial<CombineObjects<
    { readonly name: string },
    Omit<BytesLayoutItem, "binary" | "custom" | "layout">
  >>;


export type CustomizableBytesReturn<B extends BytesBase, P extends CustomizableBytes> =
  CombineObjects<
    B,
    P extends undefined
    ? { readonly binary: "bytes" }
    : P extends Layout
    ? { readonly binary: "bytes", readonly layout: P }
    : P extends Uint8Array | FixedConversion<Uint8Array, any> | CustomConversion<Uint8Array, any>
    ? { readonly binary: "bytes", readonly custom: P }
    : P extends readonly [Layout, FixedConversion<any, any> | CustomConversion<any, any>]
    ? { readonly binary: "bytes", readonly layout: P[0], readonly custom: P[1] }
    : never
  >;

export const customizableBytes = <
  const B extends BytesBase,
  const C extends CustomizableBytes
>(base: B, spec?: C) => ({
  ...base,
  binary: "bytes",
  ...(() => {
    if (spec === undefined)
      return {};

    if (isLayout(spec))
      return { layout: spec };

    if (spec instanceof Uint8Array || isFixedBytesConversion(spec) || !Array.isArray(spec))
      return { custom: spec };

    return { layout: spec[0], custom: spec[1] };
  })()
} as CustomizableBytesReturn<B, C>);

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

export const checkBytesTypeEqual = (
  custom: BytesType,
  data: BytesType,
  opts?: {
    customSlice?: number | readonly [number, number];
    dataSlize?: number | readonly [number, number];
  }): void => {
  const toSlice = (bytes: BytesType, slice?: number | readonly [number, number]) =>
    slice === undefined
      ? [0, bytes.length] as const
      : Array.isArray(slice)
      ? slice
      : [slice, bytes.length] as const;

  const [customStart, customEnd] = toSlice(custom, opts?.customSlice);
  const [dataStart, dataEnd] = toSlice(data, opts?.dataSlize);
  const length = customEnd - customStart;
  checkSize(length, dataEnd - dataStart);

  for (let i = 0; i < custom.length; ++i)
    if (custom[i + customStart] !== data[i + dataStart])
      throw new Error(`binary data mismatch: ` +
        `layout value: ${custom}, offset: ${customStart}, data value: ${data}, offset: ${dataStart}`
      );
}

export function findIdLayoutPair(item: SwitchLayoutItem, data: any) {
  const id = data[item.idTag ?? "id"];
  return (item.layouts as readonly any[]).find(([idOrConversionId]) =>
    (Array.isArray(idOrConversionId) ? idOrConversionId[1] : idOrConversionId) == id
  )!;
}
