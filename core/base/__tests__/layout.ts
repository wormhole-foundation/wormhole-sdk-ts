import { describe, expect, it } from "@jest/globals";

import {
  Layout,
  LayoutToType,
  RoArray,
  addFixedValues,
  bitsetItem,
  column,
  deserializeLayout,
  layoutDiscriminator,
  serializeLayout,
  optionItem,
} from "./../src/index.js";

// prettier-ignore
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
    layout: [
      { name: "bytesDynamicSize", binary: "bytes", size: 4 },
      { name: "bytesDynamicLengthSize", binary: "bytes", lengthSize: 4 },
    ],
  },
  {
    name: "bytesFixedItem",
    binary: "bytes",
    layout: { binary: "uint", size: 1, custom: { to: 13, from: 1 } },
  },
  {
    name: "bytesDynamicItem",
    binary: "bytes",
    layout: { binary: "uint", size: 1 },
  },
  {
    name: "bytesFixedLayout",
    binary: "bytes",
    layout: [
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
    layout: [
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
    layout: [
      { name: "uintDynamicPrimitive", binary: "uint", size: 1 },
      { name: "uintFixedPrimitive", binary: "uint", size: 1, custom: 25 },
      { name: "bytesFixedPrimitive", binary: "bytes", custom: new Uint8Array(4) },
    ],
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
// import { LayoutToType, FixedItemsOfLayout, DynamicItemsOfLayout } from './../src/index.js';
// type LT = LayoutToType<typeof testLayout>;
// type FixedItems = FixedItemsOfLayout<typeof testLayout>;
// type FixedValues = LayoutToType<FixedItems>;
// type DynamicItems = DynamicItemsOfLayout<typeof testLayout>;
// type DynamicValues = LayoutToType<DynamicItems>;

// prettier-ignore
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
  const fixedIntData = { fixedSignedInt: -257 };

  it("should correctly serialize and deserialize signed integers", function () {
    const layout = [fixedInt] as const;
    const encoded = serializeLayout(layout, fixedIntData);
    expect(encoded).toEqual(new Uint8Array([0xfe, 0xff]));
    const decoded = deserializeLayout(layout, encoded);
    expect(decoded).toEqual(fixedIntData);
  });

  it("should correctly serialize and deserialize little endian signed integers", function () {
    const layout = [{...fixedInt, endianness: "little"}] as const;
    const encoded = serializeLayout(layout, fixedIntData);
    expect(encoded).toEqual(new Uint8Array([0xff, 0xfe]));
    const decoded = deserializeLayout(layout, encoded);
    expect(decoded).toEqual(fixedIntData);
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

  describe("OptionItem tests", () => {
    it("basic test", () => {
      const layout = optionItem({binary: "uint", size: 1});

      const testCases = [[32, [1, 32]], [undefined, [0]]] as const;
      for (const [data, expected] of testCases) {
        const encoded = serializeLayout(layout, data);
        expect(encoded).toEqual(new Uint8Array(expected));

        const decoded = deserializeLayout(layout, encoded);
        expect(decoded).toEqual(data);
      }
    })

    it("advanced test", () => {
      const layout = { binary: "array", layout: [
        { name: "firstOption", ...optionItem({binary: "uint", size: 1}) },
        { name: "someUint", binary: "uint", size: 1},
        { name: "secondOption", ...optionItem({binary: "bytes", size: 4}) },
      ]} as const satisfies Layout;

      const data = [
        { firstOption: undefined, someUint: 1, secondOption: undefined},
        { firstOption: 10,        someUint: 2, secondOption: undefined },
        { firstOption: undefined, someUint: 3, secondOption: new Uint8Array([1,2,3,4]) },
        { firstOption: 20,        someUint: 4, secondOption: new Uint8Array([5,6,7,8]) },
      ] as const;
      const expected = new Uint8Array([
        ...[0,     1, 0            ],
        ...[1, 10, 2, 0            ],
        ...[0,     3, 1, 1, 2, 3, 4],
        ...[1, 20, 4, 1, 5, 6, 7, 8],
      ]);

      const encoded = serializeLayout(layout, data);
      expect(encoded).toEqual(new Uint8Array(expected));

      const decoded = deserializeLayout(layout, encoded);
      expect(decoded).toEqual(data);
    })
  })

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

describe("Switch Layout Size Tests", () => {
  it("Can discriminate a set of layouts", () => {
    const layouta = [
      {
        name: "payload",
        binary: "bytes",
        lengthSize: 2,
        layout: [
          {
            name: "payload",
            binary: "switch",
            idSize: 1,
            layouts: [
              [[0, "Direct"], []],
              [[1, "Payload"], [{ name: "data", binary: "bytes", lengthSize: 4 }]],
            ],
          },
        ],
      },
    ] as const satisfies Layout;

    const layoutb = [
      {
        name: "payload",
        binary: "bytes",
        lengthSize: 3,
        layout: [
          {
            name: "payload",
            binary: "switch",
            idSize: 1,
            layouts: [
              [[0, "Nothing"], []],
              [[1, "Data"], [{ name: "data", binary: "bytes", lengthSize: 4 }]],
            ],
          },
        ],
      },
    ] as const satisfies Layout;

    const messageLayouts = [
      ["Layout", layouta],
      ["LayoutB", layoutb],
    ] as const satisfies RoArray<[string, Layout]>;
    const messageDiscriminator = layoutDiscriminator(column(messageLayouts, 1));

    const b: LayoutToType<typeof layoutb> = {
      payload: {
        payload: { id: "Data", data: new Uint8Array([0, 0, 0, 0]) },
      },
    };

    const data = serializeLayout(layoutb, b);
    const idx = messageDiscriminator(data);
    expect(idx).toEqual(1);
  });
});
