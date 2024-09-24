import type { PublicKeyInitData } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { deriveAddress } from './account.js';

import type { CustomConversion, Layout } from '@wormhole-foundation/sdk-connect';

export const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111"
);

export function deriveProgramDataAddress(programId: PublicKeyInitData): PublicKey {
  return deriveAddress(
    [new PublicKey(programId).toBuffer()],
    BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
  );
}

//the program data pda coincides with the address that's stored in the program id account (i.e. the
//  account that's found at the program id address), which is of type UpgradeLoaderState::Program:
//  https://docs.rs/solana-program/latest/src/solana_program/bpf_loader_upgradeable.rs.html#40-43
export function programDataAddress(programId: PublicKeyInitData) {
  return PublicKey.findProgramAddressSync([new PublicKey(programId).toBytes()], BPF_LOADER_UPGRADEABLE_PROGRAM_ID)[0];
}

const onChainUint = { binary: "uint", endianness: "little" } as const;

const pubKeyConversion = { //TODO find a better place for this
  to: (encoded: Uint8Array) => new PublicKey(encoded),
  from: (decoded: PublicKey) => decoded.toBytes(),
} as const satisfies CustomConversion<Uint8Array, PublicKey>;

//Describes the layout of an account that holds a UpgradeableLoaderState::ProgramData enum:
//  https://docs.rs/solana-program/latest/src/solana_program/bpf_loader_upgradeable.rs.html#45-52
//  because neither Anchor nor Solana web3 seem to have a built-in way to parse this.
//The bpf_loader_upgradeable program uses Rust's serde crate and bincode to serialize its structs,
//  which encodes enum variants as 4 byte little endian uints:
//    https://github.com/serde-rs/serde/blob/9f8c579bf5f7478f91108c1186cd0d3f85aff29d/serde_derive/src/ser.rs#L399-L408
//  and Options with a single byte 0 or 1 tag:
//    https://docs.rs/bincode/latest/src/bincode/ser/mod.rs.html#137-147
//However, even if the program is made immutable the bpf_loader_upgradeable program will keep the
//  last value of the enum variant and only set the option byte tag to 0, presumably so they don't
//  have to memcopy the entire subsequent bytecode (they didn't really think that one through).
//See https://explorer.solana.com/address/GDDMwNyyx8uB6zrqwBFHjLLG3TBYk2F8Az4yrQC5RzMp
//  as an example of an immutable program data account.
export const programDataLayout = [
  { name: "programDataEnumVariant", ...onChainUint, size: 4, custom: 3, omit: true },
  { name: "slot", ...onChainUint, size: 8 },
  {
    name: "upgradeAuthority",
    binary: "switch",
    idSize: 1,
    idTag: "isSome",
    layouts: [
      [[0, false], [{ name: "_lastValueBeforeImmutability", binary: "bytes", size: 32 }]],
      [[1, true], [{ name: "value", binary: "bytes", size: 32, custom: pubKeyConversion }]],
    ],
  },
  { name: "bytecode", binary: "bytes" },
] as const satisfies Layout;
