export type ConcatStringLiterals<Arr extends readonly any[]> =
  Arr extends readonly [infer S extends string, ...infer Tail extends readonly any[]]
  ? `${S}${ConcatStringLiterals<Tail>}`
  : "";

export type Flatten<T extends readonly any[]> =
  T extends readonly [infer Head, ...infer Tail]
  ? Head extends readonly any[]
    ? readonly [...Head, ...Flatten<Tail>]
    : readonly [Head, ...Flatten<Tail>]
  : readonly [];

export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

export type Extends<T, U> = [T] extends [U] ? true : false;

//allow both And<reaonly boolean[]> and And<boolean, boolean>
export type And<T extends readonly boolean[] | boolean, R extends boolean = true> =
  R extends true
  ? T extends readonly boolean[]
    ? Extends<T[number], true>
    : Extends<T, true>
  : false;

export type Not<B extends boolean> =
  B extends true ? false : B extends false ? true : boolean;

//TODO IndexIsType* needs more thought (currently brittle)
//     also: can't this simply be solved via TupArr[number][Index] extends Type ?
type IndexIsTypeArray<TupArr extends readonly (readonly any[])[], Index, Type> =
  TupArr extends readonly [infer A extends readonly any[], ...infer Tail extends readonly any[]]
  ? Index extends keyof A
    ? [A[Index] extends Type ? true : false, ...IndexIsTypeArray<Tail, Index, Type>]
    : never
  : [];

//TODO bad naming
export type IndexIsType<TupArr extends readonly (readonly any[])[], Index, Type> =
  And<IndexIsTypeArray<TupArr, Index, Type>>;

//the Exclude<T, undefined> here seems silly but for some reason TypeScript incorrectly inferred
//  undefined as a possible value for T when used in conjunction with a generic type parameter
export type DefinedOrDefault<T, D> = undefined extends T ? D : Exclude<T, undefined>;

//see here: https://stackoverflow.com/a/55541672
export type IsAny<T> = Extends<0, 1 & T>;

export type IsNever<T> = Extends<T, never>;

//see here: https://stackoverflow.com/a/53955431
export type UnionToIntersection<U> =
  (U extends any ? (_: U) => void : never) extends ((_: infer I) => void) ? I : never;

export type IsUnion<T> = Not<Extends<T, UnionToIntersection<T>>>;

export type IsUnionMember<T, U> =
  And<[Extends<T,U>, IsUnion<U>, Not<IsUnion<T>>, Not<IsNever<T>>, Not<IsAny<T>>]>;

// type MyUnion = 'foo' | 'bar' | 'baz';
// type Test1 = IsUnionMember<'foo', MyUnion>; // true
// type Test2 = IsUnionMember<'bar', MyUnion>; // true
// type Test3 = IsUnionMember<'baz', MyUnion>; // true
// type Test4 = IsUnionMember<'foo' | 'baz', MyUnion>; // false
// type Test5 = IsUnionMember<any, MyUnion>; // false
// type Test6 = IsUnionMember<never, MyUnion>; // false
