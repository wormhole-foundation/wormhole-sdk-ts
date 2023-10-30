import {
  Layout,
  LayoutItem,
  LayoutToType,
  FixedPrimitiveBytesLayoutItem,
  FixedValueBytesLayoutItem,
  CustomConversion,
  UintSizeToPrimitive,
  UintType,
  BytesType,
  isUintType,
  isBytesType,
  numberMaxSize,
} from "./layout";

import { checkUint8ArrayDeeplyEqual, checkUintEquals } from "./utils";

export function deserializeLayout<const L extends Layout>(
  layout: L,
  encoded: Uint8Array,
  offset?: number,
  consumeAll?: true,
): LayoutToType<L>;

export function deserializeLayout<const L extends Layout>(
  layout: L,
  encoded: Uint8Array,
  offset?: number,
  consumeAll?: false,
): readonly [LayoutToType<L>, number];

export function deserializeLayout<const L extends Layout>(
  layout: L,
  encoded: Uint8Array,
  offset = 0,
  consumeAll = true,
): LayoutToType<L> | readonly [LayoutToType<L>, number] {
  const [decoded, finalOffset] = internalDeserializeLayout(layout, encoded, offset);

  if (consumeAll && finalOffset !== encoded.length)
    throw new Error(`encoded data is longer than expected: ${encoded.length} > ${finalOffset}`);

  return consumeAll ? decoded as LayoutToType<L> : [decoded as LayoutToType<L>, finalOffset];
}

function internalDeserializeLayout(
  layout: Layout,
  encoded: Uint8Array,
  offset: number,
): [any, number] {
  let decoded = {} as any;
  for (const item of layout)
    [((item as any).omit ? {} : decoded)[item.name], offset] =
      deserializeLayoutItem(item, encoded, offset);

  return [decoded, offset];
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

function deserializeLayoutItem(
  item: LayoutItem,
  encoded: Uint8Array,
  offset: number,
): readonly [any, number] {
  try {
    switch (item.binary) {
      case "uint": {
        const [value, newOffset] = deserializeUint(encoded, offset, item.size);

        if (isUintType(item.custom)) {
          checkUintEquals(item.custom, value);
          return [item.custom, newOffset];
        }

        if (isUintType(item?.custom?.from)) {
          checkUintEquals(item!.custom!.from, value);
          return [item!.custom!.to, newOffset];
        }

        //narrowing to CustomConver<UintType, any> is a bit hacky here, since the true type
        //  would be CustomConver<number, any> | CustomConver<bigint, any>, but then we'd have to
        //  further tease that apart still for no real gain...
        type narrowedCustom = CustomConversion<UintType, any>;
        return [
          item.custom !== undefined ? (item.custom as narrowedCustom).to(value) : value,
          newOffset
        ];
      }
      case "bytes": {
        let newOffset;
        let fixedFrom;
        let fixedTo;
        if (item.custom !== undefined) {
          if (isBytesType(item.custom))
            fixedFrom = item.custom;
          else if (isBytesType(item.custom.from)) {
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

        type narrowedCustom = CustomConversion<BytesType, any>;
        return [
          item.custom !== undefined ? (item.custom as narrowedCustom).to(value) : value,
          newOffset
        ];
      }
      case "array": {
        let ret = [] as LayoutToType<typeof item.layout>[];
        if (item.lengthSize !== undefined) {
          const [length, newOffset] = deserializeUint(encoded, offset, item.lengthSize);
          offset = newOffset;
          for (let i = 0; i < length; ++i)
            [ret[i], offset] = internalDeserializeLayout(item.layout, encoded, offset);
        }
        else {
          while (offset < encoded.length)
            [ret[ret.length], offset] = internalDeserializeLayout(item.layout, encoded, offset);
        }
        return [ret, offset];
      }
      case "object": {
        return internalDeserializeLayout(item.layout, encoded, offset);
      }
      case "switch": {
        const [id, newOffset] = deserializeUint(encoded, offset, item.idSize);
        const {idLayoutPairs} = item;
        if (idLayoutPairs.length === 0)
          throw new Error(`switch item '${item.name}' has no idLayoutPairs`);

        const hasPlainIds = typeof idLayoutPairs[0][0] === "number";
        const pair = (idLayoutPairs as any[]).find(([idOrConversionId]) =>
          hasPlainIds ? idOrConversionId === id : (idOrConversionId)[0] === id);
        
        if (pair === undefined)
          throw new Error(`unknown id value: ${id}`);

        const [idOrConversionId, idLayout] = pair;
        const [decoded, nextOffset] = internalDeserializeLayout(idLayout, encoded, newOffset);
        return [
          { [item.idTag ?? "id"]: hasPlainIds ? id : (idOrConversionId as any)[1],
            ...decoded
          },
          nextOffset
        ];
      }
    }
  }
  catch (e) {
    (e as Error).message = `when deserializing item '${item.name}': ${(e as Error).message}`;
    throw e;
  }
}
