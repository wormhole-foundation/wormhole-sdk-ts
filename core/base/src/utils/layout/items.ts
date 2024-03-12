import type { NumSizeToPrimitive} from "./layout";
import { numberMaxSize } from "./layout";

//TODO implement enum item

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
