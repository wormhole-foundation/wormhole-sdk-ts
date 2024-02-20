import { describe, expect, it } from "@jest/globals";

import {
  Layout,
  serializeLayout,
  deserializeLayout,
  addFixedValues,
  layoutDiscriminator,
  bitsetItem,
} from "../src";

const testLayout = [
  { name: "uintFixedPrimitive", binary: "uint", size: 1, custom: 3 },
  {
    name: "uintFixedCustom",
    binary: "uint",
    size: 1,
    custom: { to: "fixedConverted", from: 1 },
  },
  { name: "uintDynamicPrimitive", binary: "uint", size: 1 },
  {
    name: "uintDynamicCustom",
    binary: "uint",
    size: 1,
    custom: { to: (val: number) => val + 1, from: (val: number) => val - 1 },
  },
  {
    name: "bytesDynamicCustomLayout",
    binary: "bytes",
    custom: [
      { name: "bytesDynamicSize", binary: "bytes", size: 4 },
      { name: "bytesDynamicLengthSize", binary: "bytes", lengthSize: 4 },
    ],
  },
  {
    name: "bytesFixedItem",
    binary: "bytes",
    custom: { binary: "uint", size: 1, custom: { to: 13, from: 1 } },
  },
  {
    name: "bytesDynamicItem",
    binary: "bytes",
    custom: { binary: "uint", size: 1 },
  },
  {
    name: "bytesFixedLayout",
    binary: "bytes",
    custom: [
      {
        name: "uintFixedCustom",
        binary: "uint",
        size: 1,
        custom: { to: "fixedConverted", from: 1 },
      },
      { name: "bytesFixedPrimitive", binary: "bytes", custom: new Uint8Array(4) },
    ],
  },
  {
    name: "bytesMixedLayout",
    binary: "bytes",
    custom: [
      { name: "bytesFixedPrimitive", binary: "bytes", custom: new Uint8Array(4) },
      { name: "uintFixedCustom", binary: "uint", size: 1, custom: { to: 33, from: 1 } },
      { name: "uintDynamicPrimitive", binary: "uint", size: 1 },
    ],
  },
  {
    name: "arrayDynamicItem",
    binary: "array",
    lengthSize: 1,
    layout: { binary: "uint", size: 1 },
  },
  {
    name: "arrayMixedLayout",
    binary: "array",
    lengthSize: 1,
    layout: { binary: "bytes", custom: [
      { name: "uintDynamicPrimitive", binary: "uint", size: 1 },
      { name: "uintFixedPrimitive", binary: "uint", size: 1, custom: 25 },
      { name: "bytesFixedPrimitive", binary: "bytes", custom: new Uint8Array(4) },
    ]},
  },
  {
    name: "switchMixed",
    binary: "switch",
    idSize: 2,
    layouts: [
      [1, [
        { name: "case1FixedUint", binary: "uint", size: 1, custom: 4 },
        { name: "case1DynamicUint", binary: "uint", size: 1 }
      ]],
      [3, [
        { name: "case2FixedBytes", binary: "bytes", custom: new Uint8Array(2) },
        { name: "case2DynamicBytes", binary: "bytes", size: 2 }
      ]],
    ],
  }
] as const satisfies Layout;

// uncomment the following to "test" correct type resolution:
// import { LayoutToType, FixedItemsOfLayout, DynamicItemsOfLayout } from "../src";
// type FixedItems = FixedItemsOfLayout<typeof testLayout>;
// type FixedValues = LayoutToType<FixedItems>;
// type DynamicItems = DynamicItemsOfLayout<typeof testLayout>;
// type DynamicValues = LayoutToType<DynamicItems>;

describe("Layout tests", function () {

  const completeValues = {
    uintFixedPrimitive: 3,
    uintFixedCustom: "fixedConverted",
    uintDynamicPrimitive: 2,
    uintDynamicCustom: 4,
    bytesDynamicCustomLayout: {
      bytesDynamicSize: new Uint8Array(4),
      bytesDynamicLengthSize: new Uint8Array(5),
    },
    bytesFixedItem: 13,
    bytesDynamicItem: 3,
    bytesFixedLayout: {
      uintFixedCustom: "fixedConverted",
      bytesFixedPrimitive: new Uint8Array(4),
    },
    bytesMixedLayout: {
      bytesFixedPrimitive: new Uint8Array(4),
      uintFixedCustom: 33,
      uintDynamicPrimitive: 4,
    },
    arrayDynamicItem: [1, 2, 3],
    arrayMixedLayout: [
      {
        uintDynamicPrimitive: 10,
        uintFixedPrimitive: 25,
        bytesFixedPrimitive: new Uint8Array(4),
      },
      {
        uintDynamicPrimitive: 11,
        uintFixedPrimitive: 25,
        bytesFixedPrimitive: new Uint8Array(4),
      },
    ],
    switchMixed: {
      id: 1,
      case1FixedUint: 4,
      case1DynamicUint: 18,
    }
  } as const;

  it("should correctly add fixed values", function () {
    const dynamicValues = {
      uintDynamicPrimitive: 2,
      uintDynamicCustom: 4,
      bytesDynamicCustomLayout: {
        bytesDynamicSize: new Uint8Array(4),
        bytesDynamicLengthSize: new Uint8Array(5),
      },
      bytesDynamicItem: 3,
      bytesMixedLayout: {
        uintDynamicPrimitive: 4,
      },
      arrayDynamicItem: [1, 2, 3],
      arrayMixedLayout: [
        { uintDynamicPrimitive: 10 },
        { uintDynamicPrimitive: 11 },
      ],
      switchMixed: {
        id: 1,
        case1DynamicUint: 18,
      }
    } as const;

    const complete = addFixedValues(testLayout, dynamicValues);
    expect(complete).toEqual(completeValues);
  });

  const fixedInt = { name: "fixedSignedInt", binary: "int", size: 2 } as const;

  it("should correctly serialize and deserialize signed integers", function () {
    const layout = [fixedInt] as const;
    const encoded = serializeLayout(layout, { fixedSignedInt: -257 });
    expect(encoded).toEqual(new Uint8Array([0xfe, 0xff]));
    const decoded = deserializeLayout(layout, encoded);
    expect(decoded).toEqual({ fixedSignedInt: -257 });
  });

  it("should correctly serialize and deserialize little endian signed integers", function () {
    const layout = [{...fixedInt, endianness: "little"}] as const;
    const encoded = serializeLayout(layout, { fixedSignedInt: -257 });
    expect(encoded).toEqual(new Uint8Array([0xff, 0xfe]));
    const decoded = deserializeLayout(layout, encoded);
    expect(decoded).toEqual({ fixedSignedInt: -257 });
  });

  describe("Bitset tests", function () {
    const names = ["first",,"third", "fourth",,,,, "ninth"] as const;
    const converted = {
      first: true,
      third: false,
      fourth: true,
      ninth: true
    } as const;

    it("should correctly serialize and deserialize Bitset items with default size", function () {
      const bitset = bitsetItem(names);

      const encoded = serializeLayout(bitset, converted);
      expect(encoded).toEqual(new Uint8Array([0x01, 0x09]));
      const decoded = deserializeLayout(bitset, encoded);
      expect(decoded).toEqual(converted);
    });

    it("should correctly serialize and deserialize Bitset items with manual size", function () {
      const bitset = bitsetItem(names, 3);

      const encoded = serializeLayout(bitset, converted);
      expect(encoded).toEqual(new Uint8Array([0x00, 0x01, 0x09]));
      const decoded = deserializeLayout(bitset, encoded);
      expect(decoded).toEqual(converted);
    });
  });

  it("should serialize and deserialize correctly", function () {
    const encoded = serializeLayout(testLayout, completeValues);
    const decoded = deserializeLayout(testLayout, encoded);
    expect(decoded).toEqual(completeValues);
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
      const layouts = [
        [{name: "type", binary: "uint", size: 1}],
        [{name: "type", binary: "uint", size: 1}],
        [
          {name: "type", binary: "uint", size: 1},
          {name: "data", binary: "uint", size: 1}
        ],
      ] as readonly Layout[];
      expect (()=>layoutDiscriminator(layouts, false)).toThrow()

      const discriminator = layoutDiscriminator(layouts, true);
      expect(discriminator(Uint8Array.from([0]))).toEqual([0, 1]);
      expect(discriminator(Uint8Array.from([0, 0]))).toEqual([2]);
    });

  });
});
