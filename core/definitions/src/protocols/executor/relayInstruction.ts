import { DeriveType, Layout } from "binary-layout";
import { universalAddressItem } from "../../layout-items/universalAddress.js";

export const gasInstructionLayout = [
  { name: "gasLimit", binary: "uint", size: 16 },
  { name: "msgValue", binary: "uint", size: 16 },
] as const satisfies Layout;

export type GasInstruction = DeriveType<typeof gasInstructionLayout>;

export const gasDropOffInstructionLayout = [
  { name: "dropOff", binary: "uint", size: 16 },
  { name: "recipient", ...universalAddressItem },
] as const satisfies Layout;

export type GasDropOffInstruction = DeriveType<typeof gasDropOffInstructionLayout>;

export const stacksNttReceiveInstructionLayout = [
  { name: "nttManager", binary: "bytes", lengthSize: 1 }, // Stacks contract principal (variable length)
  { name: "recipient", binary: "bytes", lengthSize: 1 }, // Stacks recipient address (variable length)
  { name: "gasDropOff", binary: "uint", size: 16 }, // STX amount for gas drop-off
] as const satisfies Layout;

export type StacksNttReceiveInstruction = DeriveType<typeof stacksNttReceiveInstructionLayout>;

export const relayInstructionLayout = [
  {
    name: "request",
    binary: "switch",
    idSize: 1,
    idTag: "type",
    layouts: [
      [[1, "GasInstruction"], gasInstructionLayout],
      [[2, "GasDropOffInstruction"], gasDropOffInstructionLayout],
      [[3, "StacksNttReceiveInstruction"], stacksNttReceiveInstructionLayout],
    ],
  },
] as const satisfies Layout;

export type RelayInstruction = DeriveType<typeof relayInstructionLayout>;

export const relayInstructionsLayout = [
  {
    name: "requests",
    binary: "array",
    layout: relayInstructionLayout,
  },
] as const satisfies Layout;

export type RelayInstructions = DeriveType<typeof relayInstructionsLayout>;
