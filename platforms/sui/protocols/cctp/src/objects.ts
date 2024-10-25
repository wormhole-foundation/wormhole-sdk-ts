import { constMap, type MapLevels, type Network } from "@wormhole-foundation/sdk-connect";

type SuiCircleObjects = {
  tokenMessengerState: string;
  messageTransmitterState: string;
  usdcTreasury: string;
}

export const _suiCircleObjects = [[
  "Testnet", {
    tokenMessengerState:"0xf410286d2c2d11722e8ef90260b942e8dd598d1b7dc9c72214ef814a4e2220b8",
    messageTransmitterState: "0x18855ad15df31f43aa3e5c23433a3c62b15a9297716de66756f06d1464a0a6f7",
    usdcTreasury: "0x7170137d4a6431bf83351ac025baf462909bffe2877d87716374fb42b9629ebe",
  },
], [
  "Mainnet", {
    tokenMessengerState:"0x9887393d8c9eccad3e25d7ac04d7b5a1fb53b557df2f84e48d2846903b109b32",
    messageTransmitterState: "0xd89e73191571cd3de6247ec00d6af48d89c245a7582c39fde20d08456c9b52f8",
    usdcTreasury: "0x57d6725e7a8b49a7b2a612f6bd66ab5f39fc95332ca48be421c3229d514a6de7",
  }
]] as const satisfies MapLevels<[Network, SuiCircleObjects]>;

export const suiCircleObjects = constMap(_suiCircleObjects, [0, 1]);
