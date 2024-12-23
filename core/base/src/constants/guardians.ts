import { replaceElement } from "./../utils/index.js";

// Mainnet guardian sets
const guardianSet1 = [
  ["0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5", "Certus One"],
  ["0xfF6CB952589BDE862c25Ef4392132fb9D4A42157", "Staked"],
  ["0x114De8460193bdf3A2fCf81f86a09765F4762fD1", "Figment"],
  ["0x107A0086b32d7A0977926A205131d8731D39cbEB", "ChainodeTech"],
  ["0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2", "Inotel"],
  ["0x11b39756C042441BE6D8650b69b54EbE715E2343", "HashQuark"],
  ["0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd", "ChainLayer"],
  ["0xeB5F7389Fa26941519f0863349C223b73a6DDEE7", "DokiaCapital"],
  ["0x74a3bf913953D695260D88BC1aA25A4eeE363ef0", "Forbole"],
  ["0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e", "Staking Fund"],
  ["0xAF45Ced136b9D9e24903464AE889F5C8a723FC14", "Moonlet"],
  ["0xf93124b7c738843CBB89E864c862c38cddCccF95", "P2P Validator"],
  ["0xD2CC37A4dc036a8D232b48f62cDD4731412f4890", "01node"],
  ["0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811", "MCF"],
  ["0x71AA1BE1D36CaFE3867910F99C09e347899C19C3", "Everstake"],
  ["0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf", "Chorus One"],
  ["0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8", "syncnode"],
  ["0x5E1487F35515d02A92753504a8D75471b9f49EdB", "Triton"],
  ["0x6FbEBc898F403E4773E95feB15E80C9A99c8348d", "Staking Facilities"],
] as const;

const guardianSet2 = replaceElement(guardianSet1, 7, [
  "0x66B9590e1c41e0B226937bf9217D1d67Fd4E91F5",
  "FTX",
] as const);

const guardianSet3 = replaceElement(guardianSet2, 7, [
  "0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20",
  "xLabs",
] as const);

const guardianSet4 = replaceElement(guardianSet3, 0, [
  "0x5893B5A76c3f739645648885bDCcC06cd70a3Cd3",
  "RockawayX",
] as const);

// Testnet guardian sets
const testnetGuardianSet1 = [
  ["0x13947Bd48b18E53fdAeEe77F3473391aC727C638", "Testnet guardian"],
] as const;

// TODO: Attempting to use `constMap` results in a type instantiation too deep error
const guardianSetsMap = {
  Mainnet: {
    1: guardianSet1,
    2: guardianSet2,
    3: guardianSet3,
    4: guardianSet4,
  },
  Testnet: {
    1: testnetGuardianSet1,
  },
} as const;

type GuardianSetsMap = typeof guardianSetsMap;

type GuardianInfo = {
  address: string;
  name: string;
};

export function getGuardianSet<N extends keyof GuardianSetsMap, I extends keyof GuardianSetsMap[N]>(
  network: N,
  index: I,
): GuardianInfo[] {
  const guardianSet = guardianSetsMap[network][index] as readonly [string, string][];
  return guardianSet.map(([address, name]) => ({
    address,
    name,
  }));
}

export const devnetGuardianPrivateKey =
  "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";

// Number of seconds we expect to wait for attestation
// Used for eta calculation in route code
export const guardianAttestationEta = 5;
