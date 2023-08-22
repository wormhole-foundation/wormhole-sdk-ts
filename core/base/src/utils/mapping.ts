//everything in here is really just a band-aid/cover for the fact that TypeScript (despite having
// capital T type in its name) lacks support for higher-order type functions.
import { range } from "./array";
import { DefinedOrDefault, IndexIsType } from "./metaprogramming";

//TODO implement both static and runtime equal length checking for all TupleArrays
type TupleArray = readonly (readonly any[])[]; //TODO should any be unknown here?

export type ToMapping<
  TupArr extends TupleArray,
  KeyIndex extends number | undefined = 0,
  ValIndex extends number | undefined = 1,
> = IndexIsType<TupArr, DefinedOrDefault<KeyIndex, 0>, PropertyKey> extends true
  ? { readonly [E in TupArr[number] as E[DefinedOrDefault<KeyIndex, 0>]]:
        E[DefinedOrDefault<ValIndex, 1>]
    }
  : never;

export const toMapping = <
  const A extends TupleArray,
  K extends number | undefined,
  V extends number | undefined,
>(arr: A, keyIndex?: K, valIndex?: V) =>
  arr.reduce(
    (acc, entry) => {
      acc[entry[keyIndex ?? 0]] = entry[valIndex ?? 1];
      return acc;
    },
    {} as any
  ) as ToMapping<A, K, V>;

export const toMappingFunc = <M extends Record<any, any>>(mapping: M) =>
  (key: keyof M) => mapping[key];

export type Column<TupArr extends TupleArray, Index> =
  { [K in keyof TupArr]: Index extends keyof TupArr[K] ? TupArr[K][Index] : never };

export const column = <
  const TupArr extends TupleArray,
  Index extends number,
>(tupArr: TupArr, index: Index) =>
  tupArr.map((tuple) => tuple[index]) as Column<TupArr, Index>;

export type Unzip<TupArr extends TupleArray> =
  //we use "infer A" here instead of just using TupArr[0] directly, because [K in keyof TupArr[0]]
  //  also gives us all the object properties (such as length, toString, ...) that we don't want,
  //  while using the "infer A" trick gives us only the actual indexes (as string literals)
  TupArr[0] extends infer A ? { [K in keyof A]: Column<TupArr, K> } : never;

export const unzip = <const A extends TupleArray>(arr: A) =>
  range(arr[0].length).map(i => column(arr, i)) as unknown as Unzip<A>;

export type Zip<TupArr extends TupleArray> =
  TupArr[0] extends infer A
  ? { [K in keyof A]:
      readonly [...{ [K2 in keyof TupArr]: K extends keyof TupArr[K2] ? TupArr[K2][K] : never }]
    }
  : never

export const zip = <const Args extends TupleArray>(...arr: readonly [...Args]) =>
  range(arr[0].length).map(col =>
    range(arr.length).map(row => arr[row][col])
  ) as unknown as Zip<Args>;

export type ReverseRecord<T extends Record<PropertyKey, any>> =
  { [V in T[keyof T]]: { [K in keyof T]: T[K] extends V ? K : never }[keyof T] }

export const [reverseMapping, reverseArrayMapping] = (() => {
  //TODO take another look at this! - pretty sure this can be improved/combined
  const checkAndSet = (acc: any, key: PropertyKey, value: unknown): void => {
    if (acc[key] !== undefined)
      throw new Error(
        `Mapping can't be uniquely inverted: ` +
        `key ${String(key)} has at least two values: ${acc[key]} and ${String(value)}}`
      );
    acc[key] = value;
  };

  return [
    <T extends Record<PropertyKey, PropertyKey>>(obj: T) =>
      Object.entries(obj).reduce(
        (acc, [key, value]) => {
          checkAndSet(acc, value, key);
          return acc;
        },
        {} as any
      ) as { [K in keyof T as T[K]]: K },

    <T extends Record<PropertyKey, readonly PropertyKey[]>>(obj: T) =>
      Object.entries(obj).reduce(
        (acc, [key, array]) => {
          for (const value of array)
            checkAndSet(acc, value, key);
          return acc;
        },
        {} as any
      ) as { [K in keyof T as T[K][number]]: K }
    ];
})();
