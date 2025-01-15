import {
  Connection,
  PublicKeyInitData,
  TransactionInstruction,
} from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import {
  deserializeLayout,
  serializeLayout,
  type CustomConversion,
  type Layout,
} from '@wormhole-foundation/sdk-connect';
import { meta } from './account.js';

export const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey(
  'BPFLoaderUpgradeab1e11111111111111111111111',
);

//The program data pda coincides with the address that's stored in the program id account (i.e. the
//  account that's found at the program id address), which is of type UpgradeLoaderState::Program:
//  https://docs.rs/solana-program/latest/src/solana_program/bpf_loader_upgradeable.rs.html#40-43
export function programDataAddress(programId: PublicKeyInitData) {
  return PublicKey.findProgramAddressSync(
    [new PublicKey(programId).toBytes()],
    BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
  )[0];
}

export async function fetchProgramData(
  connection: Connection,
  programId: PublicKeyInitData,
): Promise<{
  slot: bigint;
  upgradeAuthority: PublicKey | undefined;
}> {
  const accountInfo = await connection.getAccountInfo(new PublicKey(programId));
  if (accountInfo === null) {
    throw new Error(`Could not read the deployed program: ${programId}`);
  }

  const data = deserializeLayout(programDataLayout, accountInfo.data);
  const upgradeAuthority = data.upgradeAuthority.isSome
    ? data.upgradeAuthority.value
    : undefined;

  return {
    slot: data.slot,
    upgradeAuthority,
  };
}

export async function setProgramAuthority(
  connection: Connection,
  programId: PublicKeyInitData,
  newAuthority: PublicKeyInitData,
): Promise<TransactionInstruction> {
  const SET_AUTHORITY_CODE = 4;

  const { upgradeAuthority } = await fetchProgramData(connection, programId);
  if (upgradeAuthority === undefined) {
    throw new Error(
      `Cannot set a new authority for the program ${programId} as the program is not upgradeable`,
    );
  }

  const accountsInfo = [
    meta(programDataAddress(programId)).writable(),
    meta(upgradeAuthority).signer(),
    meta(new PublicKey(newAuthority)),
  ];

  return new TransactionInstruction({
    keys: accountsInfo,
    programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
    data: Buffer.from(
      serializeLayout({ ...onChainUint, size: 4 }, SET_AUTHORITY_CODE),
    ),
  });
}

const onChainUint = { binary: 'uint', endianness: 'little' } as const;

const pubKeyConversion = {
  //TODO find a better place for this
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
  {
    name: 'programDataEnumVariant',
    ...onChainUint,
    size: 4,
    custom: 3,
    omit: true,
  },
  { name: 'slot', ...onChainUint, size: 8 },
  {
    name: 'upgradeAuthority',
    binary: 'switch',
    idSize: 1,
    idTag: 'isSome',
    layouts: [
      [
        [0, false],
        [{ name: '_lastValueBeforeImmutability', binary: 'bytes', size: 32 }],
      ],
      [
        [1, true],
        [
          {
            name: 'value',
            binary: 'bytes',
            size: 32,
            custom: pubKeyConversion,
          },
        ],
      ],
    ],
  },
  { name: 'bytecode', binary: 'bytes' },
] as const satisfies Layout;
