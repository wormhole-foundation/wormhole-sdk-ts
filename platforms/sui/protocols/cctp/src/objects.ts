import { constMap, type MapLevels, type Network } from "@wormhole-foundation/sdk-connect";

type SuiCircleObjects = {
  tokenMessengerState: string;
  messageTransmitterState: string;
  usdcTreasury: string;
};

export const _suiCircleObjects = [
  [
    "Testnet",
    {
      tokenMessengerState: "0x5252abd1137094ed1db3e0d75bc36abcd287aee4bc310f8e047727ef5682e7c2",
      messageTransmitterState: "0x98234bd0fa9ac12cc0a20a144a22e36d6a32f7e0a97baaeaf9c76cdc6d122d2e",
      usdcTreasury: "0x7170137d4a6431bf83351ac025baf462909bffe2877d87716374fb42b9629ebe",
    },
  ],
  [
    "Mainnet",
    {
      tokenMessengerState: "0x45993eecc0382f37419864992c12faee2238f5cfe22b98ad3bf455baf65c8a2f",
      messageTransmitterState: "0xf68268c3d9b1df3215f2439400c1c4ea08ac4ef4bb7d6f3ca6a2a239e17510af",
      usdcTreasury: "0x57d6725e7a8b49a7b2a612f6bd66ab5f39fc95332ca48be421c3229d514a6de7",
    },
  ],
] as const satisfies MapLevels<[Network, SuiCircleObjects]>;

export const suiCircleObjects = constMap(_suiCircleObjects, [0, 1]);
