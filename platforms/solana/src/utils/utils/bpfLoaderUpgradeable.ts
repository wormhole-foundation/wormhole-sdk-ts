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

const pubKeyConversion = { //TODO find a better place for this
  to: (encoded: Uint8Array) => new PublicKey(encoded),
  from: (decoded: PublicKey) => decoded.toBytes(),
} as const satisfies CustomConversion<Uint8Array, PublicKey>;

//neither anchor nor solana web3 have a built-in way to parse this
//see here: https://docs.rs/solana-program/latest/solana_program/bpf_loader_upgradeable/enum.UpgradeableLoaderState.html
export const programDataLayout = [
  { name: "slot", binary: "uint", endianness: "little", size: 8 },
  {
    name: "upgradeAuthority",
    binary: "switch",
    idSize: 1,
    idTag: "isSome",
    layouts: [
      [[0, false], []],
      [
        [1, true],
        [
          {
            name: "value",
            binary: "bytes",
            size: 32,
            custom: pubKeyConversion,
          },
        ],
      ],
    ],
  },
] as const satisfies Layout;
