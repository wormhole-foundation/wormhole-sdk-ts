import {
  Layout,
  LayoutItem,
  LayoutToType,
  LayoutItemToType,
  FixedPrimitiveBytesLayoutItem,
  FixedValueBytesLayoutItem,
  CustomConversion,
  UintSizeToPrimitive,
  numberMaxSize,
} from "./layout";

import { checkUint8ArrayDeeplyEqual, checkUintEquals } from "./utils";

export function deserializeLayout<L extends Layout>(
  layout: L,
  encoded: Uint8Array,
  offset?: number,
  consumeAll?: true,
): LayoutToType<L>;

export function deserializeLayout<L extends Layout>(
  layout: L,
  encoded: Uint8Array,
  offset?: number,
  consumeAll?: false,
): readonly [LayoutToType<L>, number];

export function deserializeLayout<L extends Layout>(
  layout: L,
  encoded: Uint8Array,
  offset = 0,
  consumeAll = true,
): LayoutToType<L> | readonly [LayoutToType<L>, number] {
  let decoded = {} as any;
  for (const item of layout)
    [((item as any).omit ? {} : decoded)[item.name], offset] =
      deserializeLayoutItem(item, encoded, offset);

  if (consumeAll && offset !== encoded.length)
    throw new Error(`encoded data is longer than expected: ${encoded.length} > ${offset}`);

  return consumeAll ? decoded as LayoutToType<L> : [decoded as LayoutToType<L>, offset];
}

function updateOffset (
  encoded: Uint8Array,
  offset: number,
  size: number
): number {
  const newOffset = offset + size;
  if (newOffset > encoded.length)
    throw new Error(`encoded data is shorter than expected: ${encoded.length} < ${newOffset}`);

  return newOffset;
}

function deserializeUint<S extends number>(
  encoded: Uint8Array,
  offset: number,
  size: S,
): readonly [UintSizeToPrimitive<S>, number] {
  let value = 0n;
  for (let i = 0; i < size; ++i)
    value += BigInt(encoded[offset + i]) << BigInt((size - 1 - i) * 8);

  return [
    ((size > numberMaxSize) ? value : Number(value)) as UintSizeToPrimitive<S>,
    updateOffset(encoded, offset, size)
  ] as const;
}

function deserializeLayoutItem (
  item: LayoutItem,
  encoded: Uint8Array,
  offset: number,
): readonly [LayoutItemToType<typeof item>, number] {
  try {
    switch (item.binary) {
      case "object": {
        return deserializeLayout(item.layout, encoded, offset, false);
      }
      case "array": {
        let ret = [] as LayoutToType<typeof item.layout>[];
        if (item.lengthSize !== undefined) {
          const [length, newOffset] = deserializeUint(encoded, offset, item.lengthSize);
          offset = newOffset;
          for (let i = 0; i < length; ++i)
            [ret[i], offset] = deserializeLayout(item.layout, encoded, offset, false);
        }
        else {
          while (offset < encoded.length)
            [ret[ret.length], offset] = deserializeLayout(item.layout, encoded, offset, false);
        }
        return [ret, offset];
      }
      case "bytes": {
        let newOffset;
        let fixedFrom;
        let fixedTo;
        if (item.custom !== undefined) {
          if (item.custom instanceof Uint8Array)
            fixedFrom = item.custom;
          else if (item.custom.from instanceof Uint8Array) {
            fixedFrom = item.custom.from;
            fixedTo = item.custom.to;
          }
        }

        if (fixedFrom !== undefined)
          newOffset = updateOffset(encoded, offset, fixedFrom.length);
        else {
          item = item as
            Exclude<typeof item, FixedPrimitiveBytesLayoutItem | FixedValueBytesLayoutItem>;
          if ("size" in item && item.size !== undefined)
            newOffset = updateOffset(encoded, offset, item.size);
          else if (item.lengthSize !== undefined) {
            let length;
            [length, offset] = deserializeUint(encoded, offset, item.lengthSize);
            newOffset = updateOffset(encoded, offset, length);
          }
          else
            newOffset = encoded.length;
        }

        const value = encoded.slice(offset, newOffset);
        if (fixedFrom !== undefined) {
          checkUint8ArrayDeeplyEqual(fixedFrom, value);
          return [fixedTo ?? fixedFrom, newOffset];
        }

        type narrowedCustom = CustomConversion<Uint8Array, any>;
        return [
          item.custom !== undefined ? (item.custom as narrowedCustom).to(value) : value,
          newOffset
        ];
      }
      case "uint": {
        const [value, newOffset] = deserializeUint(encoded, offset, item.size);

        if (item.custom !== undefined) {
          if (typeof item.custom === "number" || typeof item.custom === "bigint") {
            checkUintEquals(item.custom, value);
            return [item.custom, newOffset];
          }
          else if (typeof item.custom.from === "number" || typeof item.custom.from === "bigint") {
            checkUintEquals(item.custom.from, value);
            return [item.custom.to, newOffset];
          }
        }
        
        //narrowing to CustomConver<number | bigint, any> is a bit hacky here, since the true type
        //  would be CustomConver<number, any> | CustomConver<bigint, any>, but then we'd have to
        //  further tease that apart still for no real gain...
        type narrowedCustom = CustomConversion<number | bigint, any>;
        return [
          item.custom !== undefined ? (item.custom as narrowedCustom).to(value) : value,
          newOffset
        ];
      }
    }
  }
  catch (e) {
    (e as Error).message = `when deserializing item '${item.name}': ${(e as Error).message}`; 
    throw e;
  }
}
