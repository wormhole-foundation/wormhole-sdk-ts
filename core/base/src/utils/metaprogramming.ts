export type Extends<T, U> = [T] extends [U] ? true : false;

export type NeTuple<T = unknown> = [T, ...T[]];
export type Tuple<T = unknown> = NeTuple<T> | [];
export type RoTuple<T = unknown> = Readonly<Tuple<T>>;
export type RoNeTuple<T = unknown> = Readonly<NeTuple<T>>;
export type RoArray<T = unknown> = readonly T[];
export type RoPair<T = unknown, U = unknown> = readonly [T, U];
//Function is is a generic overload of the built-in type
//  It should work as a more powerful drop-in replacement.
//  Since the built-in type is not generic and permissive, we have to use RoArray<any> as the
//    default type of the parameters, otherwise `Test` would become false after our overload:
// type TestFunc = (...args: [string, number]) => boolean;
// type Test = TestFunc extends Function ? true : false; //true for built-in
export type Function<P extends RoArray<unknown> = RoArray<any>, R = unknown> =
  (...args: P) => R;

export type Widen<T> =
  T extends string ? string :
  T extends number ? number :
  T extends boolean ? boolean :
  T extends bigint ? bigint :
  T extends object ? object :
  T;

export type DefinedOrDefault<T, D> = undefined extends T ? D : NonNullable<T>;

//see here: https://stackoverflow.com/a/55541672
export type IsAny<T> = Extends<0, 1 & T>;

export type IsNever<T> = Extends<T, never>;

export type Not<B extends boolean> = B extends true ? false : true;

//empty And is true (neutral element)
export type And<T extends RoTuple<boolean> | boolean, R extends boolean = true> =
  R extends true
  ? T extends RoTuple<boolean>
    ? false extends T[number]
      ? false
      : true
    : T
  : false;

//empty And is false (neutral element)
export type Or<T extends RoTuple<boolean> | boolean, R extends boolean = false> =
  R extends false
  ? T extends RoTuple<boolean>
    ? true extends T[number]
      ? true
      : false
    : T
  : true;

type XorImpl<T extends RoTuple<boolean>> =
  T extends readonly [infer First, infer Second, ...infer Tail extends RoArray<boolean>]
  ? XorImpl<[boolean extends First | Second ? true : false, ...Tail]> 
  : T extends readonly [infer Final]
  ? Final
  : never; //Xor has no neutral element that we can return for the empty case

//empty Xor is not supported (xor has no neutral element)
export type Xor<T extends RoTuple<boolean> | boolean, R extends boolean | undefined = undefined> =
  T extends RoTuple<boolean>
  ? [...T, ...(undefined extends R ? [] : [Exclude<R, undefined>])] extends infer V extends RoTuple<boolean>
    ? XorImpl<V>
    : never
  : boolean extends Exclude<R, undefined> | T ? true : false;

export type ParseNumber<T> = T extends `${infer N extends number}` ? N : never;

//see here: https://stackoverflow.com/a/53955431
export type UnionToIntersection<U> =
  (U extends any ? (_: U) => void : never) extends ((_: infer I) => void) ? I : never;

export type IsUnion<T> = Not<Extends<T, UnionToIntersection<T>>>;

export type IsUnionMember<T, U> =
  And<[Extends<T,U>, IsUnion<U>, Not<IsUnion<T>>, Not<IsNever<T>>, Not<IsAny<T>>]>;

export type ConcatStringLiterals<A extends RoArray<string>> =
  A extends readonly [infer S extends string, ...infer Tail extends RoArray<string>]
  ? `${S}${ConcatStringLiterals<Tail>}`
  : "";

export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

//if we were to just use the intersection type T & U, we'd lose strict property checks
export type CombineObjects<T, U> = {
  [K in keyof T | keyof U]: K extends keyof T ? T[K] : K extends keyof U ? U[K] : never;
};

// type MyUnion = 'foo' | 'bar' | 'baz';
// type Test1 = IsUnionMember<'foo', MyUnion>; // true
// type Test2 = IsUnionMember<'bar', MyUnion>; // true
// type Test3 = IsUnionMember<'baz', MyUnion>; // true
// type Test4 = IsUnionMember<'foo' | 'baz', MyUnion>; // false
// type Test5 = IsUnionMember<any, MyUnion>; // false
// type Test6 = IsUnionMember<never, MyUnion>; // false
