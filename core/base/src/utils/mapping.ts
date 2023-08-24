//everything in here is really just a band-aid/cover for the fact that TypeScript (despite having
// capital T type in its name) lacks support for higher-order type functions.
//find tests/examples at the bottom to get some idea wtf is going on here
import {
  IndexEs,
  Flatten,
  Unflatten,
  InnerFlatten,
  IsRectangular,
  Zip,
  Cartesian,
  OnlyIndexes,
  ExcludeIndexes,
  Entries,
  Column,
  range,
  zip,
} from "./array";
import { AssertType, Function, Widen, RoArray, RoArray2D, } from "./metaprogramming";

export type ShallowMapping<M extends RoArray<readonly [PropertyKey, unknown]>> =
 { readonly [E in M[number] as E[0]]: E[1] };

//symbol probably shouldn't be part of the union (but then our type isn't a superset of PropertyKey
//  anymore which comes with its own set of headaches)
type MappableKey = PropertyKey | bigint | boolean;
function isMappableKey(key: unknown): key is MappableKey {
  return ["string", "number", "symbol", "bigint", "boolean"].includes(typeof key);
}

type ToExtPropKey<T> =
  T extends MappableKey
  ? AssertType<
      T extends bigint ? `bigint(${T})` :
      T extends boolean ? `boolean(${T})` :
      T,
      PropertyKey
    >
  : never;

type FromExtPropKey<T extends PropertyKey> =
  T extends `bigint(${infer V extends bigint})`
  ? V
  : T extends `boolean(${infer V extends boolean})`
  ? V
  : T;

type MappingEntry = readonly [MappableKey, unknown];
type MappingEntries = RoArray<MappingEntry>;

type CombineKeyValues<
  K,
  T extends MappingEntries,
  M extends RoArray,
  U extends MappingEntries = [],
> =
  T extends readonly [infer Head extends MappingEntry, ...infer Tail extends MappingEntries]
  ? Head extends readonly [infer Key extends MappableKey, infer Value]
    ? Key extends K
      ? CombineKeyValues<K, Tail, [...M, Value], U>
      : CombineKeyValues<K, Tail, M, [...U, Head]>
    : never
  : [M, U];

type ToMapEntries<T extends RoArray2D, M extends MappingEntries = []> =
  T extends readonly [infer Head, ...infer Tail extends MappingEntries]
  ? Head extends readonly [infer Key extends MappableKey, infer Value]
    ? CombineKeyValues<Key, Tail, [Value]> extends readonly [
        infer MK extends RoArray,
        infer MU extends RoArray2D
      ]
      ? ToMapEntries<MU, [...M, [Key, MK]]>
      : never
    : never
  : M;

type CartesianRightRecursive<T extends RoArray> =
  T extends RoArray<readonly [MappableKey, RoArray]>
  ? Flatten<[...{ [K in keyof T]:
      K extends `${number}`
      ? InnerFlatten<Cartesian<T[K][0], CartesianRightRecursive<T[K][1]>>>
      : never
    }]>
  : T extends readonly [MappableKey, RoArray]
  ? Cartesian<T[0], T[1]>
  : T;

const isRecursiveTuple = (arr: RoArray) =>
  arr.length === 2 && !Array.isArray(arr[0]) && Array.isArray(arr[1]);

const cartesianRightRecursive = <const T extends RoArray>(arr: T): CartesianRightRecursive<T> => (
  arr.length === 0
  ? []
  : Array.isArray(arr[0])
  ? (arr as MappingEntries).map(([key, val]) =>
      Array.isArray(val)
      ? (isRecursiveTuple(val) ? cartesianRightRecursive(val) : val).map(ele => [key, ele].flat())
      : [[key, val]]
    ).flat()
  : isRecursiveTuple(arr)
  ? cartesianRightRecursive(arr[1] as RoArray).map((ele: any) => [arr[0], ele])
  : arr
) as CartesianRightRecursive<T>;

type Shape = readonly [IndexEs, IndexEs]; //key columns, value columns
type CartesianSet<T = unknown> = RoArray2D<T>; //CartesianSet is always rectangular
type Transpose<T extends RoArray2D> = Zip<T>;

type DivideAndConquer<
  KA extends CartesianSet<MappableKey>,
  VA extends RoArray,
  KeyRows extends RoArray<readonly [MappableKey, RoArray<number>]>,
> =
  [...{
    [K in keyof KeyRows]: [
      KeyRows[K][0],
      ProcessNextKey<OnlyIndexes<KA, KeyRows[K][1]>, OnlyIndexes<VA, KeyRows[K][1]>>
    ]
  }];

type ProcessNextKey<KA extends CartesianSet<MappableKey>, VA extends RoArray> =
  KA["length"] extends 0
  ? VA
  : DivideAndConquer<
      Transpose<ExcludeIndexes<Transpose<KA>, 0>>,
      VA,
      ToMapEntries<Entries<Column<KA, 0>>>
    >;

type SplitAndReorderKeyAndValueColums<A extends CartesianSet, S extends Shape> =
  ProcessNextKey<
    Transpose<OnlyIndexes<Transpose<A>, S[0]>>,
    Unflatten<
      S[1] extends number | readonly [number]
      //if we have a single value column, we can just flatten the result
      ? Transpose<OnlyIndexes<Transpose<A>, S[1]>>
      : Unflatten<Transpose<OnlyIndexes<Transpose<A>, S[1]>>>
    >
  >;

//we encode leaf values as double singletons to distinguish them from mapping entries and arrays
//  of leaf values (in case the mapping isn't injective (i.e. a single key has multiple values
//  associated with it))
export type LeafValue = readonly [readonly [unknown]];

//returns the mapping with unwrapped values if all leaves are indeed singletons
//  otherwise returns false
type UnwrapValuesIfAllAreSingletons<M extends MappingEntries> =
  M extends readonly [infer Head, ...infer Tail extends MappingEntries]
  ? Head extends readonly [infer K, infer V]
    ? V extends readonly [LeafValue, LeafValue]
      ? false
      : V extends MappingEntries
        ? UnwrapValuesIfAllAreSingletons<V> extends MappingEntries
          ? [
              [K, UnwrapValuesIfAllAreSingletons<V>],
              ...UnwrapValuesIfAllAreSingletons<Tail>
            ]
          : false
        : V extends readonly [unknown]
        ? [readonly [K, V[0]], ...UnwrapValuesIfAllAreSingletons<Tail>]
        : false
    : never
  : [];

// type MaybeUnwrapValuesIfAllAreSingletons<T> = T;
type MaybeUnwrapValuesIfAllAreSingletons<M> =
  AssertType<
    UnwrapValuesIfAllAreSingletons<AssertType<M, MappingEntries>> extends false
    ? M
    : UnwrapValuesIfAllAreSingletons<AssertType<M, MappingEntries>>,
    MappingEntries
  >;

type TransformMapping<M extends MappingEntries, S extends Shape | undefined = undefined> =
  //check that M has a valid structure for mapping entries
  IsRectangular<CartesianRightRecursive<M>> extends true
  ? [S] extends [undefined]
    ? M
    : MaybeUnwrapValuesIfAllAreSingletons<
        SplitAndReorderKeyAndValueColums<
          CartesianRightRecursive<M>,
          //why TS doesn't narrow this automatically is beyond me
          Exclude<S, undefined>
        >
      >
  : never;

export type ObjectFromMappingEntries<M extends MappingEntries> = {
  [K in keyof M as (K extends `${number}` ? ToExtPropKey<M[K][0]> : never)]:
    M[K][1] extends readonly [LeafValue, LeafValue]
    ? Flatten<Flatten<M[K][1]>>
    : M[K][1] extends MappingEntries
    ? ObjectFromMappingEntries<M[K][1]>
    : M[K][1] extends RoArray<LeafValue>
    ? Flatten<Flatten<M[K][1]>>
    : M[K][1] extends LeafValue
    ? M[K][1][0][0]
    : M[K][1]
};

export type ToMapping<M extends MappingEntries, S extends Shape | undefined = undefined> =
  ObjectFromMappingEntries<TransformMapping<M, S>>;

const toMapping = <
  const M extends MappingEntries,
  const S extends Shape | undefined = undefined
>(mapping: M, shape?: S): ToMapping<M, S> => {
  const crr = cartesianRightRecursive(mapping);
  if (crr.length === 0)
    throw new Error("Invalid mapping: empty");

  const definedShape = (shape === undefined)
    ? [range(crr[0].length - 1), [crr[0].length - 1]]
    : shape.map(ind => typeof ind === "number" ? [ind] : ind);

  let leafObjects = [] as any[];
  //if our leafs are arrays to begin with then we should not strip them
  let allSingletons = definedShape[1].length === 1;
  const buildMapping = (
    keyCartesianSet: CartesianSet<MappableKey>,
    values: RoArray
  ): any => {
    const distinctKeys = Array.from(new Set<MappableKey>(keyCartesianSet[0]).values());
    const keyRows = new Map<MappableKey, number[]>(distinctKeys.map(key => [key, []]));
    for (const [i, key] of keyCartesianSet[0].entries())
      keyRows.get(key)!.push(i);

    if (keyCartesianSet.length === 1) {
      const ret = Object.fromEntries(distinctKeys.map(key =>
        [key, keyRows.get(key)!.flatMap(i => values[i])]
      ));

      if (allSingletons) {
        for (const valRow of keyRows.values())
          if (valRow.length !== 1) {
            allSingletons = false;
            return ret;
          }
        leafObjects.push(ret);
      }

      return ret;
    }

    const droppedKeyCol = zip(keyCartesianSet.slice(1));
    return Object.fromEntries(distinctKeys.map(key => {
      const rows = keyRows.get(key)!;
      const keyCartesianSubset = zip(rows.map(i => droppedKeyCol[i]));
      const valuesSubset = rows.map(i => values[i]);
      return [key, buildMapping(keyCartesianSubset as CartesianSet<MappableKey>, valuesSubset)];
    }));
  };

  const cols = zip(crr);
  const getCol = (col: number) => {
    const colArr = cols[col];
    if (colArr === undefined)
      throw new Error(`Invalid shape: column ${col} does not exist`);

    return colArr;
  };

  const [keyCartesianSet, leafValues] =
    definedShape.map(indx => indx.map(col => getCol(col)));

  if (keyCartesianSet.length === 0)
    throw new Error("Invalid shape: empty key set");

  if (leafValues.length === 0)
    throw new Error("Invalid shape: empty value set");

  for (const keyCol of keyCartesianSet)
    for (const key of keyCol)
      if (!isMappableKey(key))
        throw new Error(`Invalid key: ${key} in ${keyCol}`);


  const ret = buildMapping(keyCartesianSet as CartesianSet<MappableKey>, zip(leafValues));

  if (allSingletons)
    for (const leafObj of leafObjects)
      for (const key of Object.keys(leafObj))
        leafObj[key] = leafObj[key][0];

  return ret as ToMapping<M, S>;
}

type Mapped = { [key: PropertyKey]: unknown | Mapped };

type RecursiveAccess<M extends Mapped, KA extends RoArray<MappableKey>> =
  KA extends readonly [infer Head extends MappableKey, ...infer Tail extends RoArray<MappableKey>]
  ? ToExtPropKey<Head> extends keyof M
    ? M[ToExtPropKey<Head>] extends Mapped
      ? RecursiveAccess<M[ToExtPropKey<Head>], Tail>
      : M[ToExtPropKey<Head>]
    : never
  : M;

//4 layers deep ought to be enough for anyone ;) (couldn't figure out a way to make this recursive
//  as to avoid having to hardcode arity...)
type GenericMappingFunc<M extends Mapped, D extends number> =
  D extends 1
  ? <K1 extends FromExtPropKey<keyof M>>(...args: [K1]) =>
    RecursiveAccess<M, [K1]>
  : D extends 2
  ? < K1 extends FromExtPropKey<keyof M>,
      K2 extends FromExtPropKey<keyof RecursiveAccess<M, [K1]>>,
    >(...args: [K1, K2]) => RecursiveAccess<M, [K1, K2]>
  : D extends 3
  ? < K1 extends FromExtPropKey<keyof M>,
      K2 extends FromExtPropKey<keyof RecursiveAccess<M, [K1]>>,
      K3 extends FromExtPropKey<keyof RecursiveAccess<M, [K1, K2]>>,
    >(...args: [K1, K2, K3]) => RecursiveAccess<M, [K1, K2, K3]>
  : D extends 4
  ? < K1 extends FromExtPropKey<keyof M>,
      K2 extends FromExtPropKey<keyof RecursiveAccess<M, [K1]>>,
      K3 extends FromExtPropKey<keyof RecursiveAccess<M, [K1, K2]>>,
      K4 extends FromExtPropKey<keyof RecursiveAccess<M, [K1, K2, K3]>>,
    >(...args: [K1, K2, K3, K4]) => RecursiveAccess<M, [K1, K2, K3, K4]>
  : never;

//pretty hacky way to determine depth of mapping using the tools we have a hand
type MappingDepth<M extends MappingEntries, S extends Shape | undefined = undefined> =
  CartesianRightRecursive<TransformMapping<M, S>> extends RoArray2D
  ? ExcludeIndexes<CartesianRightRecursive<TransformMapping<M, S>>[0], 0>["length"]
  : 0;

type WidenArray<T extends RoArray> =
  T extends readonly [infer Head, ...infer Tail]
  ? [Widen<Head>, ...WidenArray<Tail>]
  : [];

type WidenParams<F extends Function> = WidenArray<Parameters<F>>;

type Has<F extends Function> = Function<WidenParams<F>, boolean>;
type Get<F extends Function> = Function<WidenParams<F>, ReturnType<F> | undefined>;

const has = <const F extends Function>(f: F) =>
  (...args: WidenParams<F>) => f(...args) !== undefined;

const get = <const F extends Function>(f: F) =>
  (...args: WidenParams<F>) => f(...args) as Widen<ReturnType<F>>;

type ToGenericMappingFunc<M extends MappingEntries, S extends Shape | undefined = undefined> =
  GenericMappingFunc<ToMapping<M, S>, MappingDepth<M, S>>;

type ConstMapRet<F extends Function> = F & { get: Get<F>, has: Has<F> };

export const constMap = <
  const M extends MappingEntries,
  const S extends Shape | undefined = undefined
>(mappingEntries: M, shape?: S): ConstMapRet<ToGenericMappingFunc<M, S>> => {
  const mapping = toMapping(mappingEntries, shape);
  const genericMappingFunc = ((...args: any[]) =>
    args.reduce((subMapping: any, key) =>
      subMapping[key.toString()] ?? undefined, mapping)) as ToGenericMappingFunc<M, S>;

  (genericMappingFunc as any)["get"] = get(genericMappingFunc);
  (genericMappingFunc as any)["has"] = has(genericMappingFunc);

  return genericMappingFunc as ConstMapRet<ToGenericMappingFunc<M, S>>;
}

//--- find a bunch of "tests" below

//It's unclear to me how to even properly test Typescript types, seeing how there isn't even an
//  equals operation...
//So this will have to do for now...

// const sample = [
//   [
//     "Mainnet", [
//       ["Ethereum", 1n],
//       ["Bsc", 56n],
//     ]
//   ],
//   [
//     "Testnet", [
//       ["Ethereum", 5n],
//       ["Sepolia", 11155111n],
//     ]
//   ]
// ] as const satisfies MappingEntries;

// type Test1 = ToMapping<typeof sample>;
// type Test2 = ToMapping<typeof sample, [[0,1],2]>; //same as Test1
// type Test3 = ToMapping<typeof sample, [[0,1],[2]]>; //same as Test1

// type Test10 = ToMapping<typeof sample, [[0,1],[0,1,2]]>;
// type Test11 = ToMapping<typeof sample, [[0,1],[2,1,0]]>;

// type Test20 = ToMapping<typeof sample, [0,1]>;
// type Test21 = ToMapping<typeof sample, [[0],1]>; //same as Test20
// type Test22 = ToMapping<typeof sample, [0,[1]]>; //same as Test20
// type Test23 = ToMapping<typeof sample, [[0],[1]]>; //same as Test20

// type Test30 = ToMapping<typeof sample, [2,0]>;
// type Test31 = ToMapping<typeof sample, [2,[0,1]]>;
// type Test32 = ToMapping<typeof sample, [[1,0],2]>;

// type Test40 = ToMapping<typeof sample, [1,0]>;

// const test1 = constMap(sample);
// const test1Entry1 = test1("Testnet", "Sepolia"); //11155111n
// const test2 = constMap(sample, [[0,1],2]); //same as test1
// const test2Entry1 = test2("Testnet", "Sepolia"); //same as test1Entry1
// const test2Entry2 = test2.get("doesn't", "exist"); //undefined: bigint | undefined
// const test2Entry3 = test2.has("doesn't", "exist"); //false: boolean

// const test10 = constMap(sample, [[0,1],[0,1,2]]);
// const test10Entry1 = test10("Testnet", "Sepolia"); //["Testnet", "Sepolia", 11155111n]

// const test20 = constMap(sample, [0,1]);
// const test20Entry1 = test20("Testnet"); //["Ethereum", "Sepolia"]

// const test30 = constMap(sample, [2,0]);
// const test30Entry1 = test30(1n); //"Mainnet"
// const test31 = constMap(sample, [2,[0,1]]);
// const test31Entry1 = test31(1n); //["Mainnet", "Ethereum"]
// const test31Entry2 = test31(11155111n); //["Testnet", "Sepolia"]

// const test40 = constMap(sample, [1,0]);
// const test40Entry1 = test40("Ethereum"); //["Mainnet", "Testnet"]
// const test40Entry2 = test40("Sepolia"); //["Testnet"]
// const test40Entry3 = test40("Bsc"); //["Mainnet"]

