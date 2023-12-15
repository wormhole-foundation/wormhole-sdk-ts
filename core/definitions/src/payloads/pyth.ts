import { payloadIdItem } from "../layout-items";
import { NamedPayloads, RegisterPayloadTypes, registerPayloadTypes } from "../vaa";

export const PYTH_MAGIC: number = 0x50325748;

// export enum PriceAttestationStatus {
//   Unknown = 0,
//   Trading = 1,
//   Halted = 2,
//   Auction = 3,
//   Ignored = 4,
// }

const namedPayloads = [
  [
    "PriceAttestation",
    [
      { name: "magic", binary: "bytes", size: 4 },
      { name: "versionMajor", binary: "uint", size: 2, custom: 3 },
      { name: "versionMinor", binary: "uint", size: 2, custom: 1 },
      payloadIdItem(0),
      { name: "productId", binary: "bytes", size: 32 },
      { name: "priceId", binary: "bytes", size: 32 },
      { name: "price", binary: "uint", size: 8 },
      { name: "conf", binary: "uint", size: 8 },
      { name: "expo", binary: "int", size: 4 },
      { name: "emaPrice", binary: "int", size: 8 },
      { name: "emaConf", binary: "uint", size: 8 },
      { name: "status", binary: "uint", size: 1 }, // TODO: PriceAttestationStatus item
      { name: "numPublishers", binary: "uint", size: 4 },
      { name: "maxNumPublishers", binary: "uint", size: 4 },
      { name: "attestationTime", binary: "int", size: 8 },
      { name: "publishTime", binary: "int", size: 8 },
      { name: "prevPublishTime", binary: "int", size: 8 },
      { name: "prevPrice", binary: "int", size: 8 },
      { name: "prevConf", binary: "uint", size: 8 },
      { name: "lastAttestedPublishTime", binary: "int", size: 8 },
    ],
  ],
] as const satisfies NamedPayloads;

// factory registration:

declare global {
  namespace Wormhole {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"Pyth", typeof namedPayloads> {}
  }
}

registerPayloadTypes("Pyth", namedPayloads);
