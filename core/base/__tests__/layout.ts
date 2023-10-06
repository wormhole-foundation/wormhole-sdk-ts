import { describe, expect, it } from "@jest/globals";

import { Layout, addFixedValues, layoutDiscriminator } from "@wormhole-foundation/sdk-base";

describe("Layout tests", function () {
  it("should correctly add fixed values", function () {
    const testLayout = [
      { name: "fixedDirectPrimitive", binary: "uint", size: 1, custom: 3 },
      {
        name: "fixedDirectCustom",
        binary: "uint",
        size: 1,
        custom: { to: 42, from: 1 },
      },
      { name: "dynamicDirectPrimitive", binary: "uint", size: 1 },
      {
        name: "dynamicDirectCustom",
        binary: "uint",
        size: 1,
        custom: { to: (val: number) => val + 1, from: (val: number) => val - 1 },
      },
      {
        name: "someDynamicObject",
        binary: "object",
        layout: [
          { name: "someDynamicBytes", binary: "bytes", size: 4 },
          { name: "someDynamicLengthBytes", binary: "bytes", lengthSize: 4 },
        ],
      },
      {
        name: "objectWithOnlyFixed",
        binary: "object",
        layout: [
          {
            name: "someFixedObjectUint",
            binary: "uint",
            size: 1,
            custom: { to: 13, from: 1 },
          },
        ],
      },
      {
        name: "objectWithSomeFixed",
        binary: "object",
        layout: [
          {
            name: "someFixedBytes",
            binary: "bytes",
            custom: { to: new Uint8Array(4), from: new Uint8Array(4) },
          },
          {
            name: "someFixedUint",
            binary: "uint",
            size: 1,
            custom: { to: 33, from: 1 },
          },
          { name: "someDynamicUint", binary: "uint", size: 1 },
        ],
      },
      {
        name: "arrayWithOnlyFixed",
        binary: "array",
        lengthSize: 1,
        layout: [
          { name: "someFixedArrayUint", binary: "uint", size: 1, custom: 12 },
        ],
      },
      {
        name: "arrayWithSomeFixed",
        binary: "array",
        lengthSize: 1,
        layout: [
          { name: "someDynamicUint", binary: "uint", size: 1 },
          { name: "someFixedUint", binary: "uint", size: 1, custom: 25 },
          {
            name: "someFixedBytes",
            binary: "bytes",
            custom: { to: new Uint8Array(4), from: new Uint8Array(4) },
          },
        ],
      },
      {
        name: "arrayWithOnlyDynamic",
        binary: "array",
        lengthSize: 1,
        layout: [{ name: "someDynamicArrayUint", binary: "uint", size: 1 }],
      },
    ] as const satisfies Layout;

    const dynamicValues = {
      dynamicDirectPrimitive: 2,
      dynamicDirectCustom: 4,
      someDynamicObject: {
        someDynamicBytes: new Uint8Array(4),
        someDynamicLengthBytes: new Uint8Array(5),
      },
      objectWithSomeFixed: { someDynamicUint: 8 },
      arrayWithSomeFixed: [{ someDynamicUint: 10 }, { someDynamicUint: 11 }],
      arrayWithOnlyDynamic: [
        { someDynamicArrayUint: 14 },
        { someDynamicArrayUint: 16 },
      ],
    };

    const complete = addFixedValues(testLayout, dynamicValues);
    expect(complete).toEqual({
      fixedDirectPrimitive: 3,
      fixedDirectCustom: 42,
      dynamicDirectPrimitive: 2,
      dynamicDirectCustom: 4,
      someDynamicObject: {
        someDynamicBytes: new Uint8Array(4),
        someDynamicLengthBytes: new Uint8Array(5),
      },
      objectWithOnlyFixed: { someFixedObjectUint: 13 },
      objectWithSomeFixed: {
        someDynamicUint: 8,
        someFixedBytes: new Uint8Array(4),
        someFixedUint: 33,
      },
      arrayWithOnlyFixed: [],
      arrayWithSomeFixed: [
        {
          someDynamicUint: 10,
          someFixedUint: 25,
          someFixedBytes: new Uint8Array(4),
        },
        {
          someDynamicUint: 11,
          someFixedUint: 25,
          someFixedBytes: new Uint8Array(4),
        },
      ],
      arrayWithOnlyDynamic: [
        { someDynamicArrayUint: 14 },
        { someDynamicArrayUint: 16 },
      ],
    });
  });

  describe("Discriminate tests", function () {
    it("trivially discriminate by byte", function () {
      const discriminator = layoutDiscriminator([
        [{name: "type", binary: "uint", size: 1, custom: 0}],
        [{name: "type", binary: "uint", size: 1, custom: 2}],
      ]);
      
      expect(discriminator(Uint8Array.from([0]))).toBe(0);
      expect(discriminator(Uint8Array.from([2]))).toBe(1);
      expect(discriminator(Uint8Array.from([1]))).toBe(null);
      expect(discriminator(Uint8Array.from([]))).toBe(null);
      expect(discriminator(Uint8Array.from([0, 0]))).toBe(0);
    });

    it("discriminate by byte with different length", function () {
      const discriminator = layoutDiscriminator([
        [{name: "type", binary: "uint", size: 1, custom: 0},
         {name: "data", binary: "uint", size: 1}],
        [{name: "type", binary: "uint", size: 1, custom: 2}],
      ]);

      expect(discriminator(Uint8Array.from([0, 7]))).toBe(0);
      expect(discriminator(Uint8Array.from([2]))).toBe(1);
      expect(discriminator(Uint8Array.from([1]))).toBe(null);
      expect(discriminator(Uint8Array.from([]))).toBe(null);
      expect(discriminator(Uint8Array.from([0, 0]))).toBe(0);
    });

    it("discriminate by byte with out of bounds length length", function () {
      const discriminator = layoutDiscriminator([
        [{name: "data", binary: "uint", size: 1},
         {name: "type", binary: "uint", size: 1, custom: 0}],
        [{name: "data", binary: "uint", size: 1},
         {name: "type", binary: "uint", size: 1, custom: 2}],
        [{name: "type", binary: "uint", size: 1}],
      ]);

      expect(discriminator(Uint8Array.from([0, 0]))).toBe(0);
      expect(discriminator(Uint8Array.from([0, 2]))).toBe(1);
      expect(discriminator(Uint8Array.from([2]))).toBe(2);
      expect(discriminator(Uint8Array.from([0, 1]))).toBe(null);
      expect(discriminator(Uint8Array.from([0, 0, 0]))).toBe(0);
    });

    it("trivially discriminate by length", function() {
      const discriminator = layoutDiscriminator([
        [{name: "type", binary: "uint", size: 1},
         {name: "data", binary: "uint", size: 1}],
        [{name: "type", binary: "uint", size: 1}],
      ]);
      
      expect(discriminator(Uint8Array.from([0, 7]))).toBe(0);
      expect(discriminator(Uint8Array.from([0]))).toBe(1);
      expect(discriminator(Uint8Array.from([1]))).toBe(1);
      expect(discriminator(Uint8Array.from([]))).toBe(null);
      expect(discriminator(Uint8Array.from([0, 0, 0]))).toBe(null);
    });

    it("discriminate by byte and then size", function () {
      const discriminator = layoutDiscriminator([
        [{name: "type", binary: "uint", size: 1, custom: 0}],
        [{name: "type", binary: "uint", size: 1, custom: 2}],
        [{name: "type", binary: "uint", size: 1},
         {name: "data", binary: "uint", size: 1}],
      ]);

      expect(discriminator(Uint8Array.from([0, 7]))).toBe(2);
      expect(discriminator(Uint8Array.from([2]))).toBe(1);
      expect(discriminator(Uint8Array.from([1]))).toBe(2);
      expect(discriminator(Uint8Array.from([]))).toBe(null);
    });

    it("discriminate by byte and then either size or byte", function () {
      const discriminator = layoutDiscriminator([
        [{name: "type", binary: "uint", size: 1, custom: 0},
         {name: "data", binary: "uint", size: 1, custom: 0}],
        [{name: "type", binary: "uint", size: 1, custom: 0},
         {name: "data", binary: "uint", size: 1, custom: 1}],
        [{name: "type", binary: "uint", size: 1, custom: 1},
         {name: "data", binary: "uint", size: 1}],
        [{name: "type", binary: "uint", size: 1, custom: 1},
         {name: "data", binary: "uint", size: 1},
         {name: "dat2", binary: "uint", size: 1}]
      ]);

      expect(discriminator(Uint8Array.from([0, 0]))).toBe(0);
      expect(discriminator(Uint8Array.from([0, 1]))).toBe(1);
      expect(discriminator(Uint8Array.from([1, 0]))).toBe(2);
      expect(discriminator(Uint8Array.from([1, 0, 0]))).toBe(3);
      expect(discriminator(Uint8Array.from([]))).toBe(null);
    });

    it("cannot be uniquely discriminated", function () {
      const discriminator = layoutDiscriminator([
        [{name: "type", binary: "uint", size: 1}],
        [{name: "type", binary: "uint", size: 1}],
        [{name: "type", binary: "uint", size: 1},
         {name: "data", binary: "uint", size: 1}],
      ], false);

      expect(discriminator(Uint8Array.from([0]))).toEqual([0, 1]);
      expect(discriminator(Uint8Array.from([0, 0]))).toEqual([2]);
    });

  });
});

// type FixedItems = FixedItemsOfLayout<typeof testLayout>;
// type DynamicItems = DynamicItemsOfLayout<typeof testLayout>;

// const testFunc = <L extends Layout>(layout: L, fixedVals: LayoutToType<FixedItemsOfLayout<L>>) => {
//   return Object.keys(fixedVals).reduce((acc, key) => acc + key, "");
// }

// const test = testFunc(
//   testLayout, {
//     "fixedDirectPrimitive": 3,
//     "fixedDirectCustom": 42,
//     "objectWithOnlyFixed": { "someFixedObjectUint": 13 },
//     "objectWithSomeFixed": {
//       "someFixedBytes": new Uint8Array(4),
//       "someFixedUint": 33,
//     },
//     "arrayWithOnlyFixed": [
//       { "someFixedArrayUint": 12 },
//       { "someFixedArrayUint": 12 },
//     ],
//     "arrayWithSomeFixed": [
//       {
//         "someFixedUint": 25,
//         "someFixedBytes": new Uint8Array(4),
//       },
//       {
//         "someFixedUint": 25,
//         "someFixedBytes": new Uint8Array(4),
//       },
//     ]
//   }
// );
