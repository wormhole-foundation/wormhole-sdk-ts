export type NumType = number | bigint;
export type BytesType = Uint8Array;
export type PrimitiveType = NumType | BytesType;

//used wherever an object is expected that sprung from the LayoutToType type defined below
export type LayoutObject = { readonly [key: string]: any };

export const binaryLiterals = ["int", "uint", "bytes", "array", "switch"] as const;
export type BinaryLiterals = typeof binaryLiterals[number];
export type Endianness = "little" | "big"; //default is always big

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

export type NumSizeToPrimitive<Size extends number> =
  Size extends NumberSize
  ? number
  : Size & NumberSize extends never
  ? bigint
  : number | bigint;

export type FixedConversion<FromType extends PrimitiveType | LayoutObject, ToType> = {
  readonly to: ToType,
  readonly from: FromType,
};

export type CustomConversion<FromType extends PrimitiveType | LayoutObject, ToType> = {
  readonly to: (val: FromType) => ToType,
  readonly from: (val: ToType) => FromType,
};

export interface LayoutItemBase<BL extends BinaryLiterals> {
  readonly binary: BL,
};

interface FixedOmittableCustom<T extends PrimitiveType> {
  custom: T,
  omit?: boolean
};

//length size: number of bytes used to encode the preceeding length field which in turn
//  holds either the number of bytes (for bytes) or elements (for array)
export interface LengthPrefixed {
  readonly lengthSize: NumberSize,
  readonly lengthEndianness?: Endianness, //default is big
  // //restricts the datarange of lengthSize to a maximum value to prevent out of memory
  // //  attacks/issues
  // readonly maxLength?: number,
}

//size: number of bytes used to encode the item
interface NumLayoutItemBase<T extends NumType, Signed extends Boolean>
    extends LayoutItemBase<Signed extends true ? "int" : "uint"> {
  size: T extends bigint ? number : NumberSize,
  endianness?: Endianness, //default is big
};

export interface FixedPrimitiveNum<
  T extends NumType,
  Signed extends Boolean
> extends NumLayoutItemBase<T, Signed>, FixedOmittableCustom<T> {};

export interface OptionalToFromNum<
  T extends NumType,
  Signed extends Boolean
> extends NumLayoutItemBase<T, Signed> {
  custom?: FixedConversion<T, any> | CustomConversion<T, any>
};

export interface FixedPrimitiveBytes
  extends LayoutItemBase<"bytes">, FixedOmittableCustom<BytesType> {};

//A word on the somewhat confusing size, lengthSize, and custom properties of BytesLayouts:
//  It is a common pattern that layouts define a certain structure, while also wanting to allow
//    customization of certain portions of that structure. E.g. a layout might define a known,
//    fixed header, followed by a body, which might be the rest of the data, or have some prefixed
//    or even known, fixed size.
//  A natural way to enable this sort of functionality is to specify a layout that contains a body
//    LayoutItem with the given length/size fields, but with an overrideable custom field, where
//    the generic version simply leaves custom unspecified resulting in an raw Uint8Array.
//  Allowing such overriding can give somewhat confusing results thought:
//  For example, if layouts are only ever defined by a single party, it would never make sense to
//    specify both a size and a FixedConversion, since the former could be derived from the latter.
//    But if multiple parties are involved, one party might want to nail down the size of the data
//    itself, or the size and endianess of the length field, while another then specifies what the
//    actual content is (and this might even be done recursively, where one protocol builds on
//    top of another).
//  So to facilitate this usecase, BytesLayouts allow for this sort of redundant specification.
//
//  One annoying downside of this approach is that it allows for inconsistent specifications.
//  Following C++'s philosophy, we'll simple define the behavior as undefined in such cases.
//  We could remedy the problem by providing a consistency check function, but this too is awkward
//    because it would then perform what is effectively a verification of the code itself during
//    every startup...
//  Such are the perils of an interpreted language.
//
//Number of bytes written/read by a BytesLayout:
//  If a size is specified manually, it must be consistent with the conversion or layout.
//  If a lengthSize is specified, it will encode the size of the data on serialization, and
//    must match the size of the conversion / layout on deserialization.
//  If neither a size, nor a lengthSize is specified, and the size is not derivable from the custom
//    property (i.e. it's undefined, or a CustomConversion, or a Layout whose size can't be
//    statically determined), it will consume the rest of the data on deserialization.
export interface FlexPureBytes extends LayoutItemBase<"bytes"> {
  readonly custom?: BytesType | FixedConversion<BytesType, any> | CustomConversion<BytesType, any>,
};

export interface FlexLayoutBytes extends LayoutItemBase<"bytes"> {
  readonly custom?: FixedConversion<LayoutObject, any> | CustomConversion<LayoutObject, any>,
  readonly layout: Layout,
}

export interface ManualSizePureBytes extends FlexPureBytes {
  readonly size: number,
};

export interface LengthPrefixedPureBytes extends FlexPureBytes, LengthPrefixed {};

export interface ManualSizeLayoutBytes extends FlexLayoutBytes {
  readonly size: number,
};

export interface LengthPrefixedLayoutBytes extends FlexLayoutBytes, LengthPrefixed {};

interface ArrayLayoutItemBase extends LayoutItemBase<"array"> {
  readonly layout: Layout,
};

export interface FixedLengthArray extends ArrayLayoutItemBase {
  readonly length: number,
};

export interface LengthPrefixedArray extends ArrayLayoutItemBase, LengthPrefixed {};

//consumes the rest of the data on deserialization
export interface RemainderArray extends ArrayLayoutItemBase {};

type PlainId = number;
type ConversionId = readonly [number, unknown];
type IdProperLayoutPair<
  Id extends PlainId | ConversionId,
  P extends ProperLayout = ProperLayout
> = readonly [Id, P];
type IdProperLayoutPairs =
  readonly IdProperLayoutPair<PlainId>[] |
  readonly IdProperLayoutPair<ConversionId>[];
type DistributiveAtLeast1<T> = T extends any ? readonly [T, ...T[]] : never;
export interface SwitchLayoutItem extends LayoutItemBase<"switch"> {
  readonly idSize: NumberSize,
  readonly idEndianness?: Endianness, //default is big
  readonly idTag?: string,
  readonly layouts:
    DistributiveAtLeast1<IdProperLayoutPair<PlainId> | IdProperLayoutPair<ConversionId>>,
}

export type NumLayoutItem<Signed extends boolean = boolean> =
  //force distribution over union
  Signed extends infer S extends boolean
  ? FixedPrimitiveNum<number, S> |
    OptionalToFromNum<number, S> |
    FixedPrimitiveNum<bigint, S> |
    OptionalToFromNum<bigint, S>
  : never;

export type UintLayoutItem = NumLayoutItem<false>;
export type IntLayoutItem = NumLayoutItem<true>;
export type BytesLayoutItem =
  FixedPrimitiveBytes |
  FlexPureBytes |
  ManualSizePureBytes |
  LengthPrefixedPureBytes |
  FlexLayoutBytes |
  ManualSizeLayoutBytes |
  LengthPrefixedLayoutBytes;
export type ArrayLayoutItem = FixedLengthArray | LengthPrefixedArray | RemainderArray;
export type LayoutItem = NumLayoutItem | BytesLayoutItem | ArrayLayoutItem | SwitchLayoutItem;
export type NamedLayoutItem = LayoutItem & { readonly name: string };
export type ProperLayout = readonly NamedLayoutItem[];
export type Layout = LayoutItem | ProperLayout;

type NameOrOmitted<T extends { name: string }> = T extends {omit: true} ? never : T["name"];

export type LayoutToType<L extends Layout> =
  Layout extends L
  ? any
  : L extends infer LI extends LayoutItem
  ? LayoutItemToType<LI>
  : L extends infer P extends ProperLayout
  ? { readonly [I in P[number] as NameOrOmitted<I>]: LayoutItemToType<I> }
  : never;

type MaybeConvert<Id extends PlainId | ConversionId> =
  Id extends readonly [number, infer Converted] ? Converted : Id;

type IdLayoutPairsToTypeUnion<A extends IdProperLayoutPairs, IdTag extends string> =
  A extends infer V extends IdProperLayoutPairs
  ? V extends readonly [infer Head,...infer Tail extends IdProperLayoutPairs]
    ? Head extends IdProperLayoutPair<infer MaybeConversionId, infer P extends ProperLayout>
      ? MaybeConvert<MaybeConversionId> extends infer Id
        ? LayoutToType<P> extends infer LT extends LayoutObject
          ? { readonly [K in IdTag | keyof LT]: K extends keyof LT ? LT[K] : Id }
            | IdLayoutPairsToTypeUnion<Tail, IdTag>
          : never
        : never
      : never
    : never
  : never;

type LayoutItemToType<Item extends LayoutItem> =
  Item extends infer I extends LayoutItem
  ? I extends NumLayoutItem
    //we must infer FromType here to make sure we "hit" the correct type of the conversion
    ? I["custom"] extends CustomConversion<infer From extends NumType, infer To>
      ? To
      : I["custom"] extends FixedConversion<infer From extends NumType, infer To>
      ? To
      : I["custom"] extends undefined
      ? NumSizeToPrimitive<I["size"]>
      : I["custom"] extends NumType
      ? I["custom"]
      : NumSizeToPrimitive<I["size"]>
    : I extends BytesLayoutItem
    ? I extends { layout: Layout }
      ? I["custom"] extends CustomConversion<infer From extends LayoutObject, infer To>
        ? To
        : I["custom"] extends FixedConversion<infer From extends LayoutObject, infer To>
        ? To
        : LayoutToType<I["layout"]>
      : I["custom"] extends CustomConversion<BytesType, infer To>
      ? To
      : I["custom"] extends FixedConversion<BytesType, infer To>
      ? To
      : BytesType
    : I extends ArrayLayoutItem
    ? readonly LayoutToType<I["layout"]>[]
    : I extends SwitchLayoutItem
    ? IdLayoutPairsToTypeUnion<
      I["layouts"],
      I["idTag"] extends undefined
      ? "id"
      : I["idTag"] extends string
      ? I["idTag"]
      : "id"
    >
    : never
  : never;
