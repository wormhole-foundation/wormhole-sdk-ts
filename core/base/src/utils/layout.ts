//TODO:
// * make FixedItem recursive
// * implement a swtich layout item that maps different values (versions) to different sublayouts
// * implement a method that determines the total size of a layout, if all items have known size
// * implement a method that determines the offsets of items in a layout (if all preceding items
//     have known, fixed size (i.e. no arrays))
// * leverage the above to implement deserialization of just a set of fields of a layout
// * implement a method that takes several layouts and a serialized piece of data and quickly
//     determines which layouts this payload conforms to (might be 0 or even all!). Should leverage
//     the above methods and fixed values in the layout to quickly exclude candidates.
// * implement a method that allows "raw" serialization and deserialization" i.e. that skips all the
//     custom conversions (should only be used for testing!) or even just partitions i.e. slices
//     the encoded Uint8Array

type PrimitiveType = number | bigint | Uint8Array;
const isPrimitiveType = (x: any): x is PrimitiveType =>
  typeof x === "number" || typeof x === "bigint" || x instanceof Uint8Array;

export type BinaryLiterals = "uint" | "bytes" | "array" | "object";

//Why only a max value of 2**(6*8)?
//quote from here: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger#description
//"In a similar sense, numbers around the magnitude of Number.MAX_SAFE_INTEGER will suffer from
//  loss of precision and make Number.isInteger return true even when it's not an integer.
//  (The actual threshold varies based on how many bits are needed to represent the decimal — for
//  example, Number.isInteger(4500000000000000.1) is true, but
//  Number.isInteger(4500000000000000.5) is false.)"
//So we are being conservative and just stay away from threshold.
type NumberSize = 1 | 2 | 3 | 4 | 5 | 6;
const numberMaxSize = 6;

type UintSizeToPrimitive<Size extends number> =
  Size extends NumberSize ? number : bigint;

export type FixedConversion<FromType extends PrimitiveType, ToType> = {
  readonly to: ToType,
  readonly from: FromType,
};

export type CustomConversion<FromType extends PrimitiveType, ToType> = {
  readonly to: (val: FromType) => ToType,
  readonly from: (val: ToType) => FromType,
};

//allows recursive layouts (this should probably become mostly obsolete once custom conversions
//  for arrays/tuples is implemented? (though maybe not since it's still unclear how one would
//  implement payloads that are just a single value))
export const layoutConversion = <L extends Layout>(layout: L) => ({
  to: (val: Uint8Array): LayoutToType<L> => deserializeLayout(layout, val),
  from: (val: LayoutToType<L>): Uint8Array => serializeLayout(layout, val),
}) as const satisfies CustomConversion<Uint8Array, LayoutToType<L>>;

interface LayoutItemBase<BL extends BinaryLiterals> {
  readonly name: string,
  readonly binary: BL,
};

interface PrimitiveFixedCustom<T extends PrimitiveType> {
  custom: T,
  omit?: boolean
};

interface OptionalToFromCustom<T extends PrimitiveType> {
  custom?: FixedConversion<T, any> | CustomConversion<T, any>
};

//size: number of bytes used to encode the item
interface UintLayoutItemBase<T extends number | bigint> extends LayoutItemBase<"uint"> {
  size: T extends bigint ? number : NumberSize,
};

export interface PrimitiveFixedUintLayoutItem<T extends number | bigint>
  extends UintLayoutItemBase<T>, PrimitiveFixedCustom<T> {};

export interface OptionalToFromUintLayoutItem<T extends number | bigint>
  extends UintLayoutItemBase<T>, OptionalToFromCustom<T> {};

export interface FixedPrimitiveBytesLayoutItem
  extends LayoutItemBase<"bytes">, PrimitiveFixedCustom<Uint8Array> {};

export interface FixedValueBytesLayoutItem extends LayoutItemBase<"bytes"> {
  readonly custom: FixedConversion<Uint8Array, any>,
};

export interface FixedSizeBytesLayoutItem extends LayoutItemBase<"bytes"> {
  readonly size: number,
  readonly custom?: CustomConversion<Uint8Array, any>,
};

//length size: number of bytes used to encode the preceeding length field which in turn
//  hold either the number of bytes (for bytes) or elements (for array)
//  undefined means it will consume the rest of the data
export interface LengthPrefixedBytesLayoutItem extends LayoutItemBase<"bytes"> {
  readonly lengthSize?: NumberSize,
  readonly custom?: CustomConversion<Uint8Array, any>,
};

export interface ArrayLayoutItem extends LayoutItemBase<"array"> {
  readonly lengthSize?: NumberSize,
  readonly layout: Layout,
};

export interface ObjectLayoutItem extends LayoutItemBase<"object"> {
  readonly layout: Layout,
}

export type UintLayoutItem = |
  PrimitiveFixedUintLayoutItem<number> |
  OptionalToFromUintLayoutItem<number> |
  PrimitiveFixedUintLayoutItem<bigint> |
  OptionalToFromUintLayoutItem<bigint>;
export type BytesLayoutItem = |
  FixedPrimitiveBytesLayoutItem |
  FixedValueBytesLayoutItem |
  FixedSizeBytesLayoutItem |
  LengthPrefixedBytesLayoutItem;
export type LayoutItem = UintLayoutItem | BytesLayoutItem | ArrayLayoutItem | ObjectLayoutItem;
export type Layout = readonly LayoutItem[];

// ---- LayoutToType ----

//TODO this is an extremly ugly hack to get around the “Type instantiation is excessively deep and
//     possibly infinite” issue that popped up when ObjectLayoutItems were added
//I'm not convinced this is really necessary and that there isn't some way to amend the code which
//  prevents the issue altogether, but for now this will have to do
type Depth = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
type MaxDepth = 10;

type NameOrOmitted<T extends { name: PropertyKey }> = T extends {omit: true} ? never : T["name"];

//the order of the checks matters here!
//  if FixedConversion was tested for first, its ToType would erroneously be inferred to be a
//    the `to` function that actually belongs to a CustomConversion
//  unclear why this happens, seeing how the `from` type wouldn't fit but it happened nonetheless
export type LayoutToType<L extends Layout, D extends Depth[number] = MaxDepth> =
  [D] extends [never]
  ? never
  : { readonly [I in L[number] as NameOrOmitted<I>]: LayoutItemToType<I, D> };

export type LayoutItemToType<I extends LayoutItem, D extends Depth[number] = MaxDepth> =
  I extends ArrayLayoutItem
  ? LayoutToType<I["layout"], Depth[D]>[]
  : I extends ObjectLayoutItem
  ? LayoutToType<I["layout"], Depth[D]>
  : I extends UintLayoutItem
  ? I["custom"] extends number | bigint
    ? I["custom"]
    : I["custom"] extends CustomConversion<any, infer ToType>
    ? ToType
    : I["custom"] extends FixedConversion<any, infer ToType>
    ? ToType
    : UintSizeToPrimitive<I["size"]>
  : I extends BytesLayoutItem
  ? I["custom"] extends CustomConversion<any, infer ToType>
    ? ToType
    : I["custom"] extends FixedConversion<any, infer ToType>
    ? ToType
    : Uint8Array
  : never;

// ---- FixedItemsOfLayout ----

type FilterFixedItem<I extends LayoutItem> =
  I extends { custom: PrimitiveType | FixedConversion<PrimitiveType, any> }
  ? I
  : I extends ObjectLayoutItem | ArrayLayoutItem
  ? FixedItemsOfLayout<I["layout"]> extends readonly LayoutItem[]
    ? [FixedItemsOfLayout<I["layout"]>[number]] extends [never]
      ? never
      : { readonly [K in keyof I]: K extends "layout" ? FixedItemsOfLayout<I["layout"]> : I[K] }
    : never
  : never;

export type FixedItemsOfLayout<L extends Layout> =
  L extends readonly [infer H extends LayoutItem, ...infer T]
  ? [FilterFixedItem<H>] extends [never]
    ? T extends Layout
      ? FixedItemsOfLayout<T>
      : readonly []
    : T extends Layout
      ? readonly [FilterFixedItem<H>, ...FixedItemsOfLayout<T>]
      : readonly [FilterFixedItem<H>]
  : readonly [];

export const fixedItemsOfLayout = <L extends Layout>(layout: L): FixedItemsOfLayout<L> =>
  layout.reduce(
    (acc: any, item: any) => {
      if (item["custom"] !== undefined && (
          isPrimitiveType(item["custom"]) || isPrimitiveType(item["custom"].from)
        ))
        return [...acc, item ];
      if (item.binary === "array" || item.binary === "object") {
        const fixedItems = fixedItemsOfLayout(item.layout);
        if (fixedItems.length > 0)
          return [...acc, { ...item, layout: fixedItems }];
      }
      return acc;
    },
    [] as any
  );

// ---- DynamicItemsOfLayout ----

type FilterDynamicItem<I extends LayoutItem> =
  I extends { custom: PrimitiveType | FixedConversion<PrimitiveType, any> }
  ? never
  : I extends ObjectLayoutItem | ArrayLayoutItem
  ? DynamicItemsOfLayout<I["layout"]> extends readonly LayoutItem[]
    ? [DynamicItemsOfLayout<I["layout"]>[number]] extends [never]
      ? never
      : { readonly [K in keyof I]: K extends "layout" ? DynamicItemsOfLayout<I["layout"]> : I[K] }
    : never
  : I;

export type DynamicItemsOfLayout<L extends Layout> =
  L extends readonly [infer H extends LayoutItem, ...infer T]
  ? [FilterDynamicItem<H>] extends [never]
    ? T extends Layout
      ? DynamicItemsOfLayout<T>
      : readonly []
    : T extends Layout
      ? readonly [FilterDynamicItem<H>, ...DynamicItemsOfLayout<T>]
      : readonly [FilterDynamicItem<H>]
  : readonly [];

export const dynamicItemsOfLayout = <L extends Layout>(layout: L): DynamicItemsOfLayout<L> =>
  layout.reduce(
    (acc: any, item: any) => {
      if (item["custom"] === undefined || !(
          isPrimitiveType(item["custom"]) || isPrimitiveType(item["custom"].from)
        ))
        return [...acc, item ];
      if (item.binary === "array" || item.binary === "object") {
        const dynamicItems = dynamicItemsOfLayout(item.layout);
        if (dynamicItems.length > 0)
          return [...acc, { ...item, layout: dynamicItems }];
      }
      return acc;
    },
    [] as any
  );

export const addFixedValues = <L extends Layout>(
  layout: L,
  dynamicValues: LayoutToType<DynamicItemsOfLayout<L>>,
): LayoutToType<L> => {
  const ret = {} as any;
  for (const item of layout) {
    if (item.binary === "object") {
      const subDynamicValues = (
        (item.name in dynamicValues)
        ? dynamicValues[item.name as keyof typeof dynamicValues]
        : {}
      ) as LayoutToType<DynamicItemsOfLayout<typeof item.layout>>;
      ret[item.name] = addFixedValues(item.layout, subDynamicValues);
    }
    else if (item.binary === "array") {
      const subDynamicValues = (
        (item.name in dynamicValues)
        ? dynamicValues[item.name as keyof typeof dynamicValues]
        : []
      ) as readonly LayoutToType<DynamicItemsOfLayout<typeof item.layout>>[];
      ret[item.name] = subDynamicValues.map(element => addFixedValues(item.layout, element));
    }
    else if (item.custom !== undefined &&
        (isPrimitiveType(item.custom) || isPrimitiveType((item.custom as {from: any}).from))
      ) {
        if (!(item as {omit?: boolean})?.omit)
          ret[item.name] = isPrimitiveType(item.custom) ? item.custom : item.custom.to;
    }
    else
      ret[item.name] = dynamicValues[item.name as keyof typeof dynamicValues];
  }
  return ret as LayoutToType<L>;
}

export function serializeLayout<L extends Layout>(
  layout: L,
  data: LayoutToType<L>,
): Uint8Array;

export function serializeLayout<L extends Layout>(
  layout: L,
  data: LayoutToType<L>,
  encoded: Uint8Array,
  offset?: number,
): number;

export function serializeLayout<L extends Layout>(
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

const isFixedSizeBytes =
  (item: {binary: "bytes", size?: number}): item is FixedSizeBytesLayoutItem =>
    item.size !== undefined;

export const calcLayoutSize = (
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
        if (item.custom !== undefined) {
          if (item.custom instanceof Uint8Array)
            return acc + item.custom.length;
          else if (item.custom.from instanceof Uint8Array)
            return acc + item.custom.from.length;
        }

        item = item as FixedSizeBytesLayoutItem | LengthPrefixedBytesLayoutItem;
        
        if (isFixedSizeBytes(item))
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
function serializeUint(
  encoded: Uint8Array,
  offset: number,
  val: number | bigint,
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

const checkUint8ArraySize = (custom: Uint8Array, size: number): void => {
  if (custom.length !== size)
    throw new Error(
      `binary size mismatch: layout size: ${custom.length}, data size: ${size}`
    );
}

const checkUintEquals = (custom: number | bigint, data: number | bigint): void => {
  if (custom != data)
    throw new Error(
      `value mismatch: (constant) layout value: ${custom}, data value: ${data}`
    );
}

const checkUint8ArrayDeeplyEqual = (custom: Uint8Array, data: Uint8Array): void => {
  checkUint8ArraySize(custom, data.length);

  for (let i = 0; i < custom.length; ++i)
    if (custom[i] !== data[i])
      throw new Error(
        `binary data mismatch: layout value: ${custom}, data value: ${data}`
      );
}

function serializeLayoutItem(
  item: LayoutItem,
  data: LayoutItemToType<typeof item>,
  encoded: Uint8Array,
  offset: number
): number {
  try {
    switch (item.binary) {
      case "object": {
        data = data as LayoutItemToType<typeof item>;
        for (const i of item.layout)
          offset = serializeLayoutItem(i, data[i.name], encoded, offset);

        break;
      }
      case "array": {
        //Typescript does not infer the narrowed type of data automatically and retroactively
        data = data as LayoutItemToType<typeof item>;
        if (item.lengthSize !== undefined)
          offset = serializeUint(encoded, offset, data.length, item.lengthSize);

        for (let i = 0; i < data.length; ++i)
          offset = serializeLayout(item.layout, data[i], encoded, offset);

        break;
      }
      case "bytes": {
        data = data as LayoutItemToType<typeof item>;
        const value = (() => {
          if (item.custom !== undefined) {
            if (item.custom instanceof Uint8Array) {
              if (!(item as { omit?: boolean })?.omit)
                checkUint8ArrayDeeplyEqual(item.custom, data);
              return item.custom;
            }
            if (item.custom.from instanceof Uint8Array)
              //no proper way to deeply check equality of item.custom.to and data in JS
              return item.custom.from;
          }

          item = item as
            Exclude<typeof item, FixedPrimitiveBytesLayoutItem | FixedValueBytesLayoutItem>;
          const ret = item.custom !== undefined ? item.custom.from(data) : data;
          if (isFixedSizeBytes(item))
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
        data = data as LayoutItemToType<typeof item>;
        const value = (() => {
          if (item.custom !== undefined) {
            if (typeof item.custom == "number" || typeof item.custom === "bigint") {
              if (!(item as { omit?: boolean })?.omit)
                checkUintEquals(item.custom, data);
              return item.custom;
            }
            if (typeof item.custom.from == "number" || typeof item.custom.from === "bigint")
              //no proper way to deeply check equality of item.custom.to and data in JS
              return item.custom.from;
          }

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

// deserialize

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
): readonly [S extends NumberSize ? number : bigint, number] {
  let value = 0n;
  for (let i = 0; i < size; ++i)
    value += BigInt(encoded[offset + i]) << BigInt((size - 1 - i) * 8);

  return [
    ((size > numberMaxSize) ? value : Number(value)) as S extends NumberSize ? number : bigint,
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
          if (isFixedSizeBytes(item))
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
