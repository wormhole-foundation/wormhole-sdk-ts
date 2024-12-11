import type { RoPair, RoTuple, RoArray, Extends, Xor, Not } from './metaprogramming.js';

export type RoTuple2D<T = unknown> = RoTuple<RoTuple<T>>;
export type RoArray2D<T = unknown> = RoArray<RoArray<T>>;

type TupleRangeImpl<L extends number, A extends number[] = []> =
  A["length"] extends L
  ? A
  : TupleRangeImpl<L, [...A, A["length"]]>;

export type TupleRange<L extends number> =
  number extends L
  ? never
  : L extends any
  ? TupleRangeImpl<L>
  : never;

export type Range<L extends number> =
  L extends any
  ? number extends L
    ? number[]
    : TupleRange<L>
  : never;

export type TupleWithLength<T, L extends number> =
  TupleRange<L> extends infer R extends RoArray<number>
  ? [...{ [K in keyof R]: T }]
  : never;

export type RoTupleWithLength<T, L extends number> = Readonly<TupleWithLength<T, L>>;

export const range = <const L extends number>(length: L) =>
  [...Array(length).keys()] as Range<L>;

//capitalization to highlight that this is intended to be a literal or a union of literals
export type IndexEs = number;

//utility type to reduce boilerplate of iteration code by replacing:
// `T extends readonly [infer Head extends T[number], ...infer Tail extends RoTuple<T[number]>]`
//with just:
// `T extends HeadTail<T, infer Head, infer Tail>`
//this also avoids the somewhat common mistake of accidentally dropping the readonly modifier
export type HeadTail<T extends RoTuple, Head extends T[number], Tail extends RoTuple<T[number]>> =
  readonly [Head, ...Tail];

export type TupleEntries<T extends RoTuple> =
  [...{ [K in keyof T]: K extends `${infer N extends number}` ? [N, T[K]] : never }];

//const aware version of Array.entries
export type Entries<T extends RoArray> =
  T extends RoTuple
  ? TupleEntries<T>
  : T extends RoArray<infer U>
  ? [number, U][]
  : never;

export function entries<const T extends RoTuple>(arr: T): TupleEntries<T>;
export function entries<const T extends RoArray>(arr: T): Entries<T>;
export function entries(arr: readonly any[]): [number, any][] {
  return [...arr.entries()];
}

export type IsArray<T> = T extends RoArray<any> ? true : false;
export type IsFlat<A extends RoArray> = true extends IsArray<A[number]> ? false : true;

export type TupleFlatten<T extends RoTuple> =
  T extends HeadTail<T, infer Head, infer Tail>
  ? Head extends RoTuple
    ? [...Head, ...TupleFlatten<Tail>]
    : [Head, ...TupleFlatten<Tail>]
  : [];

type StripArray<T> = T extends RoArray<infer E> ? E : T;

export type Flatten<A extends RoArray> =
  A extends RoTuple
  ? TupleFlatten<A>
  : StripArray<A[number]>[];

export const flatten = <const A extends RoArray>(arr: A) =>
  arr.flat() as Flatten<A>;

export type InnerFlatten<A extends RoArray> =
  [...{ [K in keyof A]:
    K extends `${number}`
    ? A[K] extends RoArray
      ? Flatten<A[K]>
      : A[K]
    : never
  }];

export type Unflatten<A extends RoArray> =
  [...{ [K in keyof A]: K extends `${number}` ? [A[K]] : never }];

export type IsRectangular<T extends RoTuple> =
  T extends RoTuple2D
  ? T extends HeadTail<T, infer Head extends RoTuple, infer Tail extends RoTuple2D>
    ? Tail extends readonly []
      ? true //a column is rectangular
      : Tail[number]["length"] extends Head["length"] ? true : false
    : true //empty is rectangular
  : true; //a row is rectangular

export type Column<A extends RoArray2D, I extends number> =
  [...{ [K in keyof A]: K extends `${number}` ? A[K][I] : never }];

export const column = <const A extends RoArray2D, const I extends number>(tupArr: A, index: I) =>
  tupArr.map((tuple) => tuple[index]) as Column<A, I>;

export type TupleZip<T extends RoTuple2D> =
  IsRectangular<T> extends true
  ? T[0] extends infer Head extends RoTuple
    ? [...{ [K in keyof Head]:
        K extends `${number}`
        ? [...{ [K2 in keyof T]: K extends keyof T[K2] ? T[K2][K] : never }]
        : never
      }]
    : []
  : never;

export type Zip<A extends RoArray2D> =
  A extends RoTuple2D
  ? TupleZip<A>
  : Flatten<A>[number][][];

export const zip = <const Args extends RoArray2D>(arr: Args) =>
  range(arr[0]!.length).map(col =>
    range(arr.length).map(row => arr[row]![col])
  ) as Zip<Args>;

//extracts elements with the given indexes in the specified order, explicitly forbid unions
export type TuplePickWithOrder<A extends RoArray, I extends RoTuple<number>> =
  I extends HeadTail<I, infer Head, infer Tail>
  ? A[Head] extends undefined
    ? TuplePickWithOrder<A, Tail>
    : [A[Head], ...TuplePickWithOrder<A, Tail>]
  : [];

export type PickWithOrder<A extends RoArray, I extends RoArray<number>> =
  [A, I] extends [infer T extends RoTuple, infer TI extends RoTuple<number>]
  ? TuplePickWithOrder<T, TI>
  : A;

export const pickWithOrder =
  <const A extends RoArray, const I extends RoArray<number>>(arr: A, indexes: I) =>
    indexes.map((i) => arr[i]) as PickWithOrder<A, I>;

type FilterIndexesImpl<T extends RoTuple, I extends IndexEs, E extends boolean> =
  T extends HeadTail<T, infer Head, infer Tail>
  ? Head extends RoPair<infer J extends number, infer V>
    ? Not<Xor<Not<E>, Extends<J, I>>> extends true
      ? [V, ...FilterIndexesImpl<Tail, I, E>]
      : FilterIndexesImpl<Tail, I, E>
    : never
  : [];

export type FilterIndexes<A extends RoArray, I extends IndexEs, E extends boolean = false> =
  A extends infer T extends RoTuple
  ? FilterIndexesImpl<Entries<T>, I, E>
  : A;

export const filterIndexes = <
  const T extends RoArray,
  const I extends RoArray<number>,
  const E extends boolean = false
>(arr: T, indexes: I, exclude?: E) => {
  const indexSet = new Set(Array.isArray(indexes) ? indexes : [indexes]);
  return arr.filter((_,i) => indexSet.has(i) !== exclude) as FilterIndexes<T, I[number], E>;
};

export type Cartesian<L, R> =
  L extends RoArray
  ? Flatten<[...{ [K in keyof L]: K extends `${number}` ? Cartesian<L[K], R> : never }]>
  : R extends RoArray
  ? [...{ [K in keyof R]: K extends `${number}` ? [L, R[K]] : never }]
  : [L, R];
