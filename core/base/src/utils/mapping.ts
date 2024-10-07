//The intent of this file is probably best explained by an example:
//
// const example = [[
//   "Mainnet", [
//     ["Ethereum", 1n],
//     ["Bsc", 56n],
//     ['Polygon', 137n],
//   ]], [
//   "Testnet", [
//     ["Ethereum", 5n],
//     ["Sepolia", 11155111n],
//   ]]
// ] as const satisfies MappingEntries;
//
//Our example variable specifies a relationship between EVM chain ids and their respective chains
//  and networks. It is a shortened way to specify the full Cartesian product:
// [
//   ["Mainnet", "Ethereum", 1n],
//   ["Mainnet", "Bsc", 56n],
//   ["Mainnet", 'Polygon', 137n],
//   ["Testnet", "Ethereum", 5n],
//   ["Testnet", "Sepolia", 11155111n],
// ]
//
//Using this full cartesian product, we can define a whole host of mappings, the obvious ones being
//  (network, chain) -> EVM chain id  and its inverse (EVM chain id) -> [network, chain].
//However, we can also define a mapping (chain) -> [list of EVM chain ids].
//
//The purpose of this file is to provide a way to define such mappings in a concise and typesafe
//  manner.
//
//It leverages `as const` specificiations such as the one of example together with a shape parameter
//  which specifies the columns of our full cartesian set which are used as the keys and values
//  respectively.
//The default shape always uses the first n-1 colums as keys and the last column as the value, e.g.
//  for our example the default shape is [[0,1],2] which maps to (network, chain) -> EVM chain id
//  while [2, [0,1]] maps to (EVM chain id) -> [network, chain], and [[0,1],[0,1,2]] maps to
//  (network, chain) -> [network, chain, EVM chain id].
//
//To actually define the type-safe default mapping for our example we write:
//
// const evmChainIdMapping = constMap(example);
//
//Which in turn can then be used to look up EVM chain ids via:
//
// const ethereumMainnetId = evmChainIdMapping("Mainnet", "Ethereum");
//
//evmChainIdMapping enforces that its first argument is of the union type "Mainnet" | "Testnet",
//  and in turn the second argument can only be one of the allowed chains conditional on the given
//  network, i.e. in our case "Ethereum" | "Bsc" | "Polygon". The type of ethereumMainnetId is
//  in turn is the bigint literal 1n.
//
//In short, it behaves exactly as a normal constant object would, but makes it easy to define
//  multiple such mappings giving a single data spec. Additionally, it natively supports bigint
//  and boolean keys which are not supported by normal objects (but which are always converted
//  to strings thus losing the original datatype).

//dev notes
//K  = key
//M  = mapping entries (a spec like example)
//KC = key columns
//VC = value columns
//VR = value rows

import type {
  RoTuple2D,
  RoArray2D,
  HeadTail,
  Entries,
  Flatten,
  InnerFlatten,
  IsRectangular,
  TupleZip,
  Cartesian,
  TuplePickWithOrder,
} from './array.js';
import { range, zip } from './array.js';
import type { Widen, RoTuple, RoNeTuple, RoArray, RoPair } from './metaprogramming.js';

export type ShallowMapping<M extends RoTuple<readonly [PropertyKey, unknown]>> =
  { readonly [E in M[number] as E[0]]: E[1] };

//symbol probably shouldn't be part of the union (but then our type isn't a superset of PropertyKey
//  anymore which comes with its own set of headaches)
export type MappableKey = PropertyKey | bigint | boolean;
function isMappableKey(key: unknown): key is MappableKey {
  return ["string", "number", "symbol", "bigint", "boolean"].includes(typeof key);
}

export type MapLevel<K extends MappableKey, V> = RoTuple<RoPair<K, V>>;

type MapLevelsTuple = readonly [MappableKey, ...RoTuple<MappableKey>, unknown];
export type MapLevels<T extends MapLevelsTuple> =
  T extends HeadTail<T,infer Head extends MappableKey, infer Tail>
  ? Tail extends MapLevelsTuple
    ? MapLevel<Head, MapLevels<Tail>>
    : MapLevel<Head, Tail[0]>
  : never;

type Depth = [never, 0, 1, 2, 3, 4];

type ToExtPropKey<T extends MappableKey> =
  T extends bigint
  ? `bigint(${T})`
  : T extends boolean
  ? `boolean(${T})`
  : T;

type FromExtPropKey<T extends PropertyKey> =
  T extends `bigint(${infer V extends bigint})`
  ? V
  : T extends `boolean(${infer V extends boolean})`
  ? V
  : T;

type MappingEntry<V = unknown> = RoPair<MappableKey, V>;
type MappingEntries<V = unknown> = RoTuple<MappingEntry<V>>;

//Recursively sifts through T combining all row indexes that have key K.
//Matching rows (i.e. those with key K) have their indexes placed in IA, non-matching (unfiltered)
//  entries go to U.
type CombineKeyRowIndexes<
  K extends MappableKey,
  T extends MappingEntries<number>,
  IA extends RoTuple<number>, //all values associated with K
  U extends MappingEntries<number> = [], //rows that have been scanned and are not associated with K
> =
  T extends HeadTail<T, infer Head, infer Tail>
  ? Head[0] extends K
    ? CombineKeyRowIndexes<K, Tail, [...IA, Head[1]], U>
    : CombineKeyRowIndexes<K, Tail, IA, [...U, Head]>
  : [IA, U];

//Takes a key column and its indexes (KCI) and for each key creates the set of all row indices
//  that have that key
//In our example for the default shape, it takes the network column and turns
//  [["Mainnet", 0], ["Mainnet", 1], ["Mainnet", 2], ["Testnet", 3], ["Testnet", 4]]
//into [["Mainnet", [0,1,2]], ["Testnet", [3,4]]].
type ToMapEntries<KCI extends MappingEntries<number>, M extends MappingEntries = []> =
  KCI extends HeadTail<KCI, infer Head, infer Tail>
  ? Head extends RoPair<infer K extends MappableKey, infer V extends number>
    ? CombineKeyRowIndexes<K, Tail, [V]> extends RoPair<
        infer IA extends RoTuple,
        infer KCIU extends MappingEntries<number>
      >
      ? ToMapEntries<KCIU, [...M, [K, IA]]>
      : never
    : never
  : M;

type CartesianRightRecursive<M extends RoTuple> =
  M extends infer IM extends MappingEntries<RoTuple>
  ? Flatten<[...{ [K in keyof IM]:
    K extends `${number}`
    ? InnerFlatten<Cartesian<IM[K][0], CartesianRightRecursive<IM[K][1]>>>
    : never
  }]>
  : M extends infer IM extends MappingEntry<RoTuple>
  ? Cartesian<IM[0], IM[1]>
  : M;

type Shape = RoPair<RoTuple<number>, RoTuple<number>>; //key columns, value columns
type IndexLike = number | RoNeTuple<number>;
type ShapeLike = RoPair<IndexLike, IndexLike>;
type ShapeLikeToShape<S extends ShapeLike> =
  S extends RoPair<infer KC extends IndexLike, infer VC extends IndexLike>
  ? [KC extends number ? [KC] : KC, VC extends number ? [VC] : VC]
  : never;

type CartesianSet<T = unknown> = RoTuple2D<T>; //CartesianSet is always rectangular
type Transpose<T extends RoTuple2D, E = unknown> =
  TupleZip<T> extends infer R extends RoTuple2D<E>
  ? R
  : never;

type FlipInnerPair<T extends RoTuple<RoPair>> =
  [...{ [K in keyof T]: K extends `${number}` ? [T[K][1], T[K][0]] : never }];

type KeyRowIndexes = MappingEntries<RoTuple<number>>;
type KeyColumnToKeyRowIndexes<KC extends RoTuple<MappableKey>> =
  FlipInnerPair<Entries<KC>> extends infer FIP extends MappingEntries<number>
  ? ToMapEntries<FIP>
  : never;

//Takes the first of the reamining key columns and splits it into chunks that share the same key
//  value. Then invokes itself for each sub-chunk passing along only those value rows that belong
//  to that chunk.
//In our example for the default shape, it starts with the network column and splits it into
//  the "Mainnet" and "Testnet" chunk. The first chunk gets the first 3 rows, the second chunk
//  gets the last 2. Then the "Mainnet" chunk is recursively split into 3 chunks again, ...
type ProcessNextKeyColmn<KC extends CartesianSet<MappableKey>, VR extends RoTuple> =
  KC extends HeadTail<KC, infer Head, infer Tail>
  ? KeyColumnToKeyRowIndexes<Exclude<Head, undefined>> extends infer KRI extends KeyRowIndexes
    ? [...{ [K in keyof KRI]: [
        KRI[K][0],
        ProcessNextKeyColmn<
          Transpose<TuplePickWithOrder<Transpose<Tail>, KRI[K][1]>, MappableKey>,
          TuplePickWithOrder<VR, KRI[K][1]>
        >
      ]}]
    : never
  : VR;

//We encode leaf values as tuples of void (which does not constitute a value type and hence can't
//  come from the user) and the actual value. This allows us to later distinguish whether a value
//  is a single (singleton) leaf value and hence whether the mapping is injective (= only one value
//  per full key group) or not.
type LeafValue<T = unknown> = RoPair<void, T>;

//Takes the value columns and combines them into leaf value rows.
type CombineValueColumnsToLeafValues<VC extends CartesianSet> =
  //if we only have a single value column, we don't have to use tuples for values
  (VC["length"] extends 1 ? VC[0] : Transpose<VC>) extends infer VCT extends RoTuple
  ? [...{ [K in keyof VCT]: K extends `${number}` ? LeafValue<VCT[K]> : never }]
  : never;

//Takes a full cartesian set in row order and splits it into its key and value columns according to
//  the specified shape.
type SplitAndReorderKeyValueColumns<R extends CartesianSet, S extends Shape> =
  Transpose<R> extends infer C extends CartesianSet
  ? [TuplePickWithOrder<C, S[0]>, TuplePickWithOrder<C, S[1]>]
  : never;

//returns the mapping with "unwrapped" values (i.e. turns the singleton arrays back into their one
//  constituent element) if all leaves are indeed singletons, otherwise returns void
type UnwrapValuesIfAllAreSingletons<M extends MappingEntries, D extends Depth[number]> =
  D extends 1
  ? M extends infer IM extends MappingEntries<readonly [LeafValue]>
    ? [...{ [K in keyof IM]: K extends `${number}` ? [M[K][0], M[K][1][0][1]] : never }]
    : void
  : M extends infer IM extends MappingEntries<MappingEntries>
    ? [...{ [K in keyof IM]: K extends `${number}`
        ? [IM[K][0], UnwrapValuesIfAllAreSingletons<IM[K][1], Depth[D]>]
        : never
      }] extends infer U extends MappingEntries
      ? U
      : void
    : never;

type MaybeUnwrapValuesIfAllAreSingletons<M extends MappingEntries, D extends Depth[number]> =
  UnwrapValuesIfAllAreSingletons<M, D> extends infer V extends MappingEntries ? V : M;

//creates the transformed mapping and its key column count
type TransformMapping<M extends MappingEntries, S extends Shape | void = void> =
  //check that M has a valid structure for mapping entries
  CartesianRightRecursive<M> extends infer CRR extends RoTuple2D
  ? IsRectangular<CRR> extends true
    //ensure CRR is not empty
    ? CRR extends RoNeTuple<RoTuple>
      ? S extends Shape
        ? SplitAndReorderKeyValueColumns<CRR, S> extends [
          infer KC extends CartesianSet<MappableKey>,
          infer VC extends CartesianSet
        ]
        ? KC["length"] extends infer D extends Depth[number]
          ? CombineValueColumnsToLeafValues<VC> extends infer VR extends RoTuple<LeafValue>
            ? ProcessNextKeyColmn<KC, VR> extends infer TM extends MappingEntries
              ? [MaybeUnwrapValuesIfAllAreSingletons<TM, D>, D]
              : never
            : never
          : never
        : never
      //if we don't have an explicit shape, take the first row and subtract 1 (for the value
      //  column) to determine the count of key columns
      : CRR[0] extends readonly [...infer KC extends RoTuple, unknown]
        ? KC["length"] extends infer D extends Depth[number]
          ? [M, D]
          : never
        : never
      : never
    : never
  : never;

type ObjectFromMappingEntries<M extends MappingEntries, D extends Depth[number]> = {
  [K in keyof M as (K extends `${number}` ? ToExtPropKey<M[K][0]> : never)]:
  M[K] extends infer ME extends MappingEntry ? 
    ME[1] extends infer V
    ? D extends 1
      ? V extends LeafValue<infer T>
        ? T
        : V extends RoTuple<LeafValue>
        ? [...{ [K2 in keyof V]: K2 extends `${number}` ? V[K2][1] : never }]
        : V
      : V extends MappingEntries
      ? ObjectFromMappingEntries<V, Depth[D]>
      : never
    : never
  : never
};

export type ToMappingAndDepth<
  M extends MappingEntries,
  S extends ShapeLike | undefined
> =
  TransformMapping<M, S extends ShapeLike ? ShapeLikeToShape<S> : void> extends [
    infer TM extends MappingEntries,
    infer D extends Depth[number],
  ]
  ? [ObjectFromMappingEntries<TM, D>, D]
  : never;

export type ToMapping<
  M extends MappingEntries,
  S extends ShapeLike | undefined = undefined
> = ToMappingAndDepth<M, S>[0];

type Mapped = { [key: PropertyKey]: unknown | Mapped };

type RecursiveAccess<M, KA extends RoTuple<MappableKey>> =
  KA extends HeadTail<KA, infer Head, infer Tail>
  ? M extends Mapped
    ? RecursiveAccess<M[ToExtPropKey<Head>], Tail>
    : never
  : M;

//4 layers deep ought to be enough for anyone ;) (couldn't figure out a way to make this recursive
//  as to avoid having to hardcode arity...)
type GenericMappingFunc<M extends Mapped, D extends number> =
  D extends 1
  ? <const K1 extends FromExtPropKey<keyof M>>(...args: readonly [K1]) => RecursiveAccess<M, [K1]>
  : D extends 2
  ? <const K1 extends FromExtPropKey<keyof M>,
     const K2 extends FromExtPropKey<keyof RecursiveAccess<M, [K1]>>,
    >(...args: readonly [K1, K2]) => RecursiveAccess<M, [K1, K2]>
  : D extends 3
  ? <const K1 extends FromExtPropKey<keyof M>,
     const K2 extends FromExtPropKey<keyof RecursiveAccess<M, [K1]>>,
     const K3 extends FromExtPropKey<keyof RecursiveAccess<M, [K1, K2]>>,
    >(...args: readonly [K1, K2, K3]) => RecursiveAccess<M, [K1, K2, K3]>
  : D extends 4
  ? <const K1 extends FromExtPropKey<keyof M>,
     const K2 extends FromExtPropKey<keyof RecursiveAccess<M, [K1]>>,
     const K3 extends FromExtPropKey<keyof RecursiveAccess<M, [K1, K2]>>,
     const K4 extends FromExtPropKey<keyof RecursiveAccess<M, [K1, K2, K3]>>,
    >(...args: readonly [K1, K2, K3, K4]) => RecursiveAccess<M, [K1, K2, K3, K4]>
  : never;

type SubMap<M extends Mapped, D extends number, K extends PropertyKey> =
  K extends keyof M
  ? M[K] extends Mapped
    ? ConstMap<M[K], Depth[D]>
    : never
  : never;

type SubMapFunc<M extends Mapped, D extends number> =
  { readonly subMap:
      <const K extends FromExtPropKey<keyof M>>(key: K) => SubMap<M, D, ToExtPropKey<K>>
  };

type KeysOfObjectUnion<T extends Object> = T extends Object ? keyof T : never;
type ValsOfObjectUnion<T extends Object> = T extends Object ? T[keyof T] : never;

type WidenedParamsAndRetRec<M extends Mapped, D extends number> =
  D extends 1
  ? [ValsOfObjectUnion<M>]
  : M[keyof M] extends infer SubMapUnion extends Mapped
  ? WidenedParamsAndRet<SubMapUnion, Depth[D]>
  : never;

type WidenedParamsAndRet<M extends Mapped, D extends number> =
  [Widen<FromExtPropKey<KeysOfObjectUnion<M>>>, ...WidenedParamsAndRetRec<M, D>];

type HasGetFuncs<M extends Mapped, D extends number> = 
  WidenedParamsAndRet<M, D> extends [...infer P extends RoTuple<unknown>, infer R]
  ? { readonly has: (...args: P) => boolean, readonly get: (...args: P) => R | undefined }
  : never;

type ConstMap<M extends Mapped, D extends number> =
  D extends 1
  ? GenericMappingFunc<M, D> & HasGetFuncs<M, D>
  : GenericMappingFunc<M, D> & HasGetFuncs<M, D> & SubMapFunc<M, D>;

type ToConstMap<M extends MappingEntries, S extends ShapeLike | undefined = undefined> =
  ToMappingAndDepth<M, S> extends [infer TM extends Mapped, infer D extends Depth[number]]
  ? ConstMap<TM, D>
  : never;

const isRecursiveTuple = (arr: RoArray) =>
  arr.length === 2 && !Array.isArray(arr[0]) && Array.isArray(arr[1]);

export const cartesianRightRecursive =
  <const T extends RoTuple>(arr: T): CartesianRightRecursive<T> => (
    arr.length === 0
      ? []
      : Array.isArray(arr[0])
        ? (arr as MappingEntries).map(([key, val]) =>
          Array.isArray(val)
            ? (isRecursiveTuple(val) ? cartesianRightRecursive(val as unknown as RoTuple) : val)
              .map(ele => [key, ele].flat())
            : [[key, val]]
        ).flat()
        : isRecursiveTuple(arr)
          ? cartesianRightRecursive(arr[1] as RoTuple).map((ele: any) => [arr[0], ele])
          : arr
  ) as CartesianRightRecursive<T>;

const toMapping = <
  const M extends MappingEntries,
  const S extends ShapeLike | undefined = undefined
>(mapping: M, shape?: S): ToMapping<M, S> => {
  const crr = cartesianRightRecursive(mapping);
  if (crr.length === 0)
    throw new Error("Invalid mapping: empty");

  const definedShape = (shape === undefined)
    ? [range(crr[0]!.length - 1), [crr[0]!.length - 1]]
    : shape.map(ind => typeof ind === "number" ? [ind] : ind);

  // store reference to leaf object to unwrap values if all leaves are singletons
  let leafObjects = [] as any[];
  let allSingletons = true;
  const buildMappingRecursively = (
    keyCartesianSet: MappableKey[][],
    values: RoArray2D
  ): any => {
    const distinctKeys = Array.from(new Set<MappableKey>(keyCartesianSet[0]).values());
    const keyRows = new Map<MappableKey, number[]>(distinctKeys.map(key => [key, []]));
    for (const [i, key] of keyCartesianSet[0]!.entries())
      keyRows.get(key)!.push(i);

    // termination case
    if (keyCartesianSet.length === 1) {
      const ret = Object.fromEntries(distinctKeys.map(key =>
        [key, keyRows.get(key)!.map(i => values[i]!.length === 1 ? values[i]![0] : values[i])]
      ));

      if (allSingletons) {
        for (const valRow of keyRows.values())
          if (valRow.length > 1) {
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
      const keyCartesianSubset = zip(rows.map(i => droppedKeyCol[i]!));
      const valuesSubset = rows.map(i => values[i]!);
      return [
        key,
        buildMappingRecursively(keyCartesianSubset, valuesSubset)
      ];
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

  if (keyCartesianSet!.length === 0)
    throw new Error("Invalid shape: empty key set");

  if (leafValues!.length === 0)
    throw new Error("Invalid shape: empty value set");

  for (const keyCol of keyCartesianSet!)
    for (const key of keyCol)
      if (!isMappableKey(key))
        throw new Error(`Invalid key: ${key} in ${keyCol}`);

  const ret = buildMappingRecursively(keyCartesianSet! as any, zip(leafValues!));

  if (allSingletons)
    for (const leafObj of leafObjects)
      for (const key of Object.keys(leafObj))
        leafObj[key] = leafObj[key][0];

  return ret as ToMapping<M, S>;
}

export function constMap<
  const M extends MappingEntries,
  const S extends ShapeLike | undefined = undefined,
>(mappingEntries: M, shape?: S): ToConstMap<M, S> {
  const mapping = toMapping(mappingEntries, shape);
  const genericMappingFunc = ((...args: MappableKey[]) =>
    args.reduce((subMapping: any, key) =>
      subMapping ? subMapping[key.toString()] ?? undefined : undefined,
      mapping
    ));
  return Object.assign(genericMappingFunc, {
    has: (...args: RoArray<MappableKey>) => genericMappingFunc(...args) !== undefined,
    get: (...args: RoArray<MappableKey>) => genericMappingFunc(...args),
    subMap: (key: MappableKey) => (mapping as any)[key.toString()],
  }) as unknown as ToConstMap<M, S>;
}

//--- find a bunch of "tests" below

// It's unclear to me how to even properly test Typescript types, seeing how there isn't even an
//  equals operation...
// So this will have to do for now...

// const sample = [
//   [
//     "Mainnet", [
//       ["Ethereum", 1n],
//       ["Bsc", 56n],
//       ['Polygon', 137n],
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

// type Element10 = Test10["Mainnet"]["Ethereum"];
// type Element11 = Test11["Mainnet"]["Ethereum"];

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
// const test2Entry2 = test2.get("doesn't", "exist"); //undefined: <bigint chain ids> | undefined
// const test2Entry3 = test2.has("doesn't", "exist"); //false: boolean
// const test3SubMap = test2.subMap("Testnet");
// const test3Entry1 = test3SubMap("Sepolia"); //11155111n
// const test3Entry2 = test3SubMap("Ethereum"); //5n

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
