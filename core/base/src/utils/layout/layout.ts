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

export type PrimitiveType = number | bigint | Uint8Array;
export const isPrimitiveType = (x: any): x is PrimitiveType =>
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
export type NumberSize = 1 | 2 | 3 | 4 | 5 | 6;
export const numberMaxSize = 6;

export type UintSizeToPrimitive<Size extends number> =
  Size extends NumberSize ? number : bigint;

export type FixedConversion<FromType extends PrimitiveType, ToType> = {
  readonly to: ToType,
  readonly from: FromType,
};

export type CustomConversion<FromType extends PrimitiveType, ToType> = {
  readonly to: (val: FromType) => ToType,
  readonly from: (val: ToType) => FromType,
};

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

type NameOrOmitted<T extends { name: PropertyKey }> = T extends {omit: true} ? never : T["name"];

//the order of the checks matters here!
//  if FixedConversion was tested for first, its ToType would erroneously be inferred to be a
//    the `to` function that actually belongs to a CustomConversion
//  unclear why this happens, seeing how the `from` type wouldn't fit but it happened nonetheless
export type LayoutToType<L extends Layout> =
  { readonly [I in L[number] as NameOrOmitted<I>]: LayoutItemToType<I> };

export type LayoutItemToType<I extends LayoutItem> =
  [I] extends [ArrayLayoutItem]
  ? LayoutToType<I["layout"]>[]
  : [I] extends [ObjectLayoutItem]
  ? LayoutToType<I["layout"]>
  : [I] extends [UintLayoutItem]
  ? I["custom"] extends number | bigint
    ? I["custom"]
    : I["custom"] extends CustomConversion<any, infer ToType>
    ? ToType
    : I["custom"] extends FixedConversion<any, infer ToType>
    ? ToType
    : UintSizeToPrimitive<I["size"]>
  : [I] extends [BytesLayoutItem]
  ? I["custom"] extends CustomConversion<any, infer ToType>
    ? ToType
    : I["custom"] extends FixedConversion<any, infer ToType>
    ? ToType
    : Uint8Array
  : never;
