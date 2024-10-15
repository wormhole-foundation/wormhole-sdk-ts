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
    tokenMessengerState:"",
    messageTransmitterState: "",
    usdcTreasury: "",
  }
]] as const satisfies MapLevels<[Network, SuiCircleObjects]>;

export const suiCircleObjects = constMap(_suiCircleObjects, [0, 1]);
