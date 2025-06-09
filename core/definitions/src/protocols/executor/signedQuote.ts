import { DeriveType, Layout } from "binary-layout";
import { dateConversion } from "../../layout-items/date.js";

export const quoteLayout = [
  {
    name: "quote",
    binary: "switch",
    idSize: 4,
    idTag: "prefix",
    layouts: [
      [
        [0x45513031, "EQ01"],
        [
          {
            name: "quoterAddress",
            binary: "bytes",
            size: 20,
          },
          {
            name: "payeeAddress",
            binary: "bytes",
            size: 32,
          },
          { name: "srcChain", binary: "uint", size: 2 },
          { name: "dstChain", binary: "uint", size: 2 },
          {
            name: "expiryTime",
            binary: "uint",
            size: 8,
            custom: dateConversion,
          },
          { name: "baseFee", binary: "uint", size: 8 },
          { name: "dstGasPrice", binary: "uint", size: 8 },
          { name: "srcPrice", binary: "uint", size: 8 },
          { name: "dstPrice", binary: "uint", size: 8 },
        ],
      ],
    ],
  },
] as const satisfies Layout;

export type Quote = DeriveType<typeof quoteLayout>;

export const signedQuoteLayout = [
  ...quoteLayout,
  { name: "signature", binary: "bytes", size: 65 },
] as const satisfies Layout;

export type SignedQuote = DeriveType<typeof signedQuoteLayout>;
