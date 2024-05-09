import type { NumSizeToPrimitive, LayoutToType, CustomConversion } from './layout.js';
import { numberMaxSize } from './layout.js';
import type { CustomizableBytes, CustomizableBytesReturn } from './utils.js';
import { customizableBytes } from './utils.js';

//TODO implement enum item

const baseOptionItem = <const T extends CustomizableBytes>(someType: T) => ({
  binary: "switch",
  idSize: 1,
  idTag: "isSome",
  layouts: [
    [[0, false], []],
    [[1, true ], [customizableBytes({ name: "value"}, someType)]],
  ]
} as const);

type BaseOptionItem<T extends CustomizableBytes> =
  LayoutToType<ReturnType<typeof baseOptionItem<T>>>;

type BaseOptionValue<T extends CustomizableBytes> =
  LayoutToType<CustomizableBytesReturn<{}, T>> | undefined;

export function optionItem<const T extends CustomizableBytes>(optVal: T) {
  return {
    binary: "bytes",
    layout: baseOptionItem(optVal),
    custom: {
      to: (obj: BaseOptionItem<T>): BaseOptionValue<T> =>
        obj.isSome === true
        //TODO I'm really not sure why we need to manually narrow the type here
        ? (obj as Exclude<typeof obj, {isSome: false}>)["value"]
        : undefined,
      from: (value: BaseOptionValue<T>): BaseOptionItem<T> =>
        value === undefined
        ? { isSome: false }
        //TODO and this is even more sketch
        : ({ isSome: true, value } as unknown as Exclude<BaseOptionItem<T>, { isSome: false }>),
    } as const satisfies CustomConversion<BaseOptionItem<T>, BaseOptionValue<T>>
  } as const
};

export type Bitset<B extends readonly (string | undefined)[]> =
  {[K in B[number] as K extends "" | undefined ? never : K]: boolean};

type ByteSize = [
  never,
  1, 1, 1, 1, 1, 1, 1, 1,
  2, 2, 2, 2, 2, 2, 2, 2,
  3, 3, 3, 3, 3, 3, 3, 3,
  4, 4, 4, 4, 4, 4, 4, 4,
  5, 5, 5, 5, 5, 5, 5, 5,
  6, 6, 6, 6, 6, 6, 6, 6,
];

type BitsizeToBytesize<N extends number> = N extends keyof ByteSize ? ByteSize[N] : number;

export type BitsetItem<
  B extends readonly (string | undefined)[],
  S extends number = BitsizeToBytesize<B["length"]>,
> = {
  binary: "uint";
  size: S;
  custom: {
    to: (encoded: NumSizeToPrimitive<S>) => Bitset<B>;
    from: (obj: Bitset<B>) => NumSizeToPrimitive<S>;
  };
};

export const bitsetItem = <
  const B extends readonly (string | undefined)[],
  const S extends number = BitsizeToBytesize<B["length"]>,
>(bitnames: B, size?: S): BitsetItem<B, S> => ({
  binary: "uint",
  size: (size ?? Math.ceil(bitnames.length / 8)) as S,
  custom: {
    to: (encoded: NumSizeToPrimitive<S>): Bitset<B> => {
      const ret: Bitset<B> = {} as Bitset<B>;
      for (let i = 0; i < bitnames.length; ++i)
        if (bitnames[i]) //skip undefined and empty string
          //always use bigint for simplicity
          ret[bitnames[i] as keyof Bitset<B>] = (BigInt(encoded) & (1n << BigInt(i))) !== 0n;

      return ret;
    },
    from: (obj: Bitset<B>): NumSizeToPrimitive<S> => {
      let val = 0n;
      for (let i = 0; i < bitnames.length; ++i)
        if (bitnames[i] && obj[bitnames[i] as keyof Bitset<B>])
          val |= 1n << BigInt(i);

      return (bitnames.length > numberMaxSize ? val : Number(val)) as NumSizeToPrimitive<S>;
    },
  },
});
