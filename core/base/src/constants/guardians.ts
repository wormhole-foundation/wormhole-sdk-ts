import type { MapLevels} from './../utils/index.js';
import { constMap, filterIndexes, zip, cartesianRightRecursive } from './../utils/index.js';
import type { Network } from './networks.js';

// prettier-ignore
const guardianKeyAndNameEntries = [[
  "Mainnet", [
    ["0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5", "JumpCrypto"       ],
    ["0xfF6CB952589BDE862c25Ef4392132fb9D4A42157", "Staked"           ],
    ["0x114De8460193bdf3A2fCf81f86a09765F4762fD1", "Figment"          ],
    ["0x107A0086b32d7A0977926A205131d8731D39cbEB", "ChainodeTech"     ],
    ["0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2", "Inotel"           ],
    ["0x11b39756C042441BE6D8650b69b54EbE715E2343", "HashQuark"        ],
    ["0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd", "Chainlayer"       ],
    ["0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20", "xLabs"            ],
    ["0x74a3bf913953D695260D88BC1aA25A4eeE363ef0", "Forbole"          ],
    ["0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e", "StakingFund"      ],
    ["0xAF45Ced136b9D9e24903464AE889F5C8a723FC14", "MoonletWallet"    ],
    ["0xf93124b7c738843CBB89E864c862c38cddCccF95", "P2PValidator"     ],
    ["0xD2CC37A4dc036a8D232b48f62cDD4731412f4890", "01Node"           ],
    ["0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811", "MCF"              ],
    ["0x71AA1BE1D36CaFE3867910F99C09e347899C19C3", "Everstake"        ],
    ["0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf", "ChorusOne"        ],
    ["0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8", "Syncnode"         ],
    ["0x5E1487F35515d02A92753504a8D75471b9f49EdB", "Triton"           ],
    ["0x6FbEBc898F403E4773E95feB15E80C9A99c8348d", "StakingFacilities"],
  ]], [
  "Testnet", [
    ["0x13947Bd48b18E53fdAeEe77F3473391aC727C638", "Testnet guardian"]
  ]]
] as const satisfies MapLevels<[Network, string, string]>;

export const [guardianKeys, guardianNames] =
  filterIndexes(zip(cartesianRightRecursive(guardianKeyAndNameEntries)), [1, 2]);

export const guardianNameToKey = constMap(guardianKeyAndNameEntries, [[0, 2], 1]);
export const guardianKeyToName = constMap(guardianKeyAndNameEntries, [1, [0, 2]]);

export const devnetGuardianPrivateKey =
  "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";

// Number of seconds we expect to wait for attestation
// Used for eta calculation in route code
export const guardianAttestationEta = 5;
