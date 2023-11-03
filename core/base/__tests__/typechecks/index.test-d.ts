import { expectAssignable, expectNotType, expectType } from 'tsd';
import { ChainName, MappingEntries, Network, constMap } from "../../src";



const sample = [
    [
        "Mainnet", [
            ["Ethereum", 1n],
            ["Bsc", 56n],
        ]
    ],
    [
        "Testnet", [
            ["Ethereum", 5n],
            ["Sepolia", 11155111n],
        ]
    ]
] as const satisfies MappingEntries;


const test1 = constMap(sample);
const test1Entry1 = test1("Testnet", "Sepolia");
expectAssignable<bigint>(test1Entry1)

const test2 = constMap(sample, [[0, 1], 2]); //same as test1
const test2Entry1 = test2("Testnet", "Sepolia"); //same as test1Entry1
const test2Entry2 = test2.get("doesn't", "exist"); //undefined: bigint | undefined
const test2Entry3 = test2.has("doesn't", "exist"); //false: boolean
expectNotType<any>(test2Entry1)
expectNotType<any>(test2Entry2)
expectNotType<any>(test2Entry3)
// expectType<bigint>(test2Entry1)
// expectType<undefined>(test2Entry2)
// expectType<false>(test2Entry3)

const test10 = constMap(sample, [[0, 1], [0, 1, 2]]);
const test10Entry1 = test10("Testnet", "Sepolia"); //["Testnet", "Sepolia", 11155111n]
expectType<[Network, ChainName, bigint]>(test10Entry1)

const test20 = constMap(sample, [0, 1]);
const test20Entry1 = test20("Testnet"); //["Ethereum", "Sepolia"]
expectType<[ChainName, ChainName]>(test20Entry1)

const test30 = constMap(sample, [2, 0]);
const test30Entry1 = test30(1n); //"Mainnet"
expectType<Network>(test30Entry1)

const test31 = constMap(sample, [2, [0, 1]]);
const test31Entry1 = test31(1n); //["Mainnet", "Ethereum"]
expectType<[Network, ChainName]>(test31Entry1)

const test31Entry2 = test31(11155111n); //["Testnet", "Sepolia"]
expectType<[Network, ChainName]>(test31Entry2)

const test40 = constMap(sample, [1, 0]);
const test40Entry1 = test40("Ethereum"); //["Mainnet", "Testnet"]
expectType<[Network, ChainName]>(test40Entry1)
const test40Entry2 = test40("Sepolia"); //["Testnet"]
expectType<[Network]>(test40Entry2)
const test40Entry3 = test40("Bsc"); //["Mainnet"]
expectType<[Network]>(test40Entry3)

// type Test1 = ToMapping<typeof sample>;
// type Test2 = ToMapping<typeof sample, [[0, 1], 2]>; //same as Test1
// type Test3 = ToMapping<typeof sample, [[0, 1], [2]]>; //same as Test1
// 
// type Test10 = ToMapping<typeof sample, [[0, 1], [0, 1, 2]]>;
// type Test11 = ToMapping<typeof sample, [[0, 1], [2, 1, 0]]>;
// 
// type Test20 = ToMapping<typeof sample, [0, 1]>;
// type Test21 = ToMapping<typeof sample, [[0], 1]>; //same as Test20
// type Test22 = ToMapping<typeof sample, [0, [1]]>; //same as Test20
// type Test23 = ToMapping<typeof sample, [[0], [1]]>; //same as Test20
// 
// type Test30 = ToMapping<typeof sample, [2, 0]>;
// type Test31 = ToMapping<typeof sample, [2, [0, 1]]>;
// type Test32 = ToMapping<typeof sample, [[1, 0], 2]>;
// 
// type Test40 = ToMapping<typeof sample, [1, 0]>;