export type UintType = number | bigint;
export const isUintType = (x: any): x is UintType =>
  typeof x === "number" || typeof x === "bigint";

export type BytesType = Uint8Array;
export const isBytesType = (x: any): x is BytesType => x instanceof Uint8Array;

export type PrimitiveType = UintType | BytesType;
export const isPrimitiveType = (x: any): x is PrimitiveType =>
  isUintType(x) || isBytesType(x);

export type BinaryLiterals = "uint" | "bytes" | "array" | "object" | "switch";

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
interface UintLayoutItemBase<T extends UintType> extends LayoutItemBase<"uint"> {
  size: T extends bigint ? number : NumberSize,
};

export interface PrimitiveFixedUintLayoutItem<T extends UintType>
  extends UintLayoutItemBase<T>, PrimitiveFixedCustom<T> {};

export interface OptionalToFromUintLayoutItem<T extends UintType>
  extends UintLayoutItemBase<T>, OptionalToFromCustom<T> {};

export interface FixedPrimitiveBytesLayoutItem
  extends LayoutItemBase<"bytes">, PrimitiveFixedCustom<BytesType> {};

export interface FixedValueBytesLayoutItem extends LayoutItemBase<"bytes"> {
  readonly custom: FixedConversion<BytesType, any>,
};

export interface FixedSizeBytesLayoutItem extends LayoutItemBase<"bytes"> {
  readonly size: number,
  readonly custom?: CustomConversion<BytesType, any>,
};

//length size: number of bytes used to encode the preceeding length field which in turn
//  hold either the number of bytes (for bytes) or elements (for array)
//  undefined means it will consume the rest of the data
export interface LengthPrefixedBytesLayoutItem extends LayoutItemBase<"bytes"> {
  readonly lengthSize?: NumberSize,
  readonly custom?: CustomConversion<BytesType, any>,
};

export interface ArrayLayoutItem extends LayoutItemBase<"array"> {
  readonly lengthSize?: NumberSize,
  readonly arrayItem: LayoutItem,
};

export interface ObjectLayoutItem extends LayoutItemBase<"object"> {
  readonly layout: Layout,
}

type PlainId = number;
type ConversionId = readonly [number, unknown];
type IdLayoutPair<Id extends PlainId | ConversionId, L extends Layout = Layout> = readonly [Id, L];
export interface SwitchLayoutItem extends LayoutItemBase<"switch"> {
  readonly idTag?: string,
  readonly idSize: NumberSize,
  readonly idLayoutPairs: readonly IdLayoutPair<PlainId>[] | readonly IdLayoutPair<ConversionId>[],
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
export type LayoutItem =
  UintLayoutItem | BytesLayoutItem | ArrayLayoutItem | ObjectLayoutItem | SwitchLayoutItem;
export type NamedLayoutItem = LayoutItem & { readonly name: string };
export type Layout = readonly NamedLayoutItem[];

type NameOrOmitted<T extends { name: string }> = T extends {omit: true} ? never : T["name"];

export type LayoutToType<L extends Layout> =
  { readonly [I in L[number] as NameOrOmitted<I>]: LayoutItemToType<I> };

type MaybeConvert<Id extends PlainId | ConversionId> =
  Id extends readonly [number, infer Converted] ? Converted : Id;

type IdLayoutPairArray = readonly IdLayoutPair<number>[] | readonly IdLayoutPair<ConversionId>[];
type IdLayoutPairsToTypeUnion<T extends IdLayoutPairArray, IdTag extends string> =
  T extends readonly [infer Head,...infer Tail extends IdLayoutPairArray]
  ? Head extends IdLayoutPair<infer MaybeConversionId, infer L extends Layout>
    ? MaybeConvert<MaybeConversionId> extends infer Id
      ? LayoutToType<L> extends infer LT extends object
        ? { readonly [K in IdTag | keyof LT]: K extends keyof LT ? LT[K] : Id }
          | IdLayoutPairsToTypeUnion<Tail, IdTag>
        : never
      : never
    : never
  : never;

export type LayoutItemToType<I extends LayoutItem> =
  [I] extends [UintLayoutItem]
  ? I["custom"] extends UintType
    ? I["custom"]
    : I["custom"] extends CustomConversion<infer FromType extends UintType, infer ToType>
    ? ToType
    : I["custom"] extends FixedConversion<infer FromType extends UintType, infer ToType>
    ? ToType
    : UintSizeToPrimitive<I["size"]>
  : [I] extends [BytesLayoutItem]
  ? I["custom"] extends CustomConversion<BytesType, infer ToType>
    ? ToType
    : I["custom"] extends FixedConversion<BytesType, infer ToType>
    ? ToType
    : BytesType //this also covers FixedValueBytesLayoutItem (Uint8Arrays don't support literals)
  : [I] extends [ArrayLayoutItem]
  ? readonly LayoutItemToType<I["arrayItem"]>[]
  : [I] extends [ObjectLayoutItem]
  ? LayoutToType<I["layout"]>
  : [I] extends [SwitchLayoutItem]
  ? IdLayoutPairsToTypeUnion<I["idLayoutPairs"], I["idTag"] extends string ? I["idTag"] : "id">
  : never;
