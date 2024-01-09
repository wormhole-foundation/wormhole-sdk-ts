import { describe, expect, it } from "@jest/globals";

import { encoding } from "@wormhole-foundation/sdk-base";
import { UniversalAddress } from "../src/universalAddress";
import {
  createVAA,
  deserialize,
  deserializePayload,
  serialize,
  blindDeserializePayload,
  payloadDiscriminator,
} from "../src/vaa";
import "../src/payloads/governance";

//monkey-patch to allow stringifying BigInts
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

//from here: https://etherscan.io/tx/0xfe57d65421ddd689a660a7906c685954fa5c1102716452cbc8acada0214e4522
//decode via https://vaa.dev
const guardianSetUpgrade =
  "0x" +
  /*version*/ "01" +
  /*guardianSet*/ "00000002" +
  /*signature count*/ "0d" +
  /*guardian*/ "00" +
  /*r*/ "ce45474d9e1b1e7790a2d210871e195db53a70ffd6f237cfe70e2686a32859ac" +
  /*s*/ "43c84a332267a8ef66f59719cf91cc8df0101fd7c36aa1878d5139241660edc0" +
  /*v*/ "01" +
  /*guardian*/ "03" +
  /*r*/ "75cc906156ae530786661c0cd9aef444747bc3d8d5aa84cac6a6d2933d4e1a03" +
  /*s*/ "1cffa30383d4af8131e929d9f203f460b07309a647d6cd32ab1cc7724089392c" +
  /*v*/ "00" +
  /*guardian*/ "04" +
  /*r*/ "52305156cfc90343128f97e499311b5cae174f488ff22fbc09591991a0a73d8e" +
  /*s*/ "6af3afb8a5968441d3ab8437836407481739e9850ad5c95e6acfcc871e951bc3" +
  /*v*/ "01" +
  /*guardian*/ "05" +
  /*r*/ "a7956eefc23e7c945a1966d5ddbe9e4be376c2f54e45e3d5da88c2f8692510c7" +
  /*s*/ "429b1ea860ae94d929bd97e84923a18187e777aa3db419813a80deb84cc8d22b" +
  /*v*/ "00" +
  /*guardian*/ "06" +
  /*r*/ "1b2a4f3d2666608e0aa96737689e3ba5793810ff3a52ff28ad57d8efb2096773" +
  /*s*/ "5dc5537a2e43ef10f583d144c12a1606542c207f5b79af08c38656d3ac407133" +
  /*v*/ "01" +
  /*guardian*/ "08" +
  /*r*/ "6b62c8e130af3411b3c0d91b5b50dcb01ed5f293963f901fc36e7b0e50114dce" +
  /*s*/ "203373b32eb45971cef8288e5d928d0ed51cd86e2a3006b0af6a65c396c00908" +
  /*v*/ "00" +
  /*guardian*/ "09" +
  /*r*/ "e93ab4d2c8228901a5f4525934000b2c26d1dc679a05e47fdf0ff3231d98fbc2" +
  /*s*/ "07103159ff4116df2832eea69b38275283434e6cd4a4af04d25fa7a82990b707" +
  /*v*/ "01" +
  /*guardian*/ "0a" +
  /*r*/ "a643f4cf615dfff06ffd65830f7f6cf6512dabc3690d5d9e210fdc712842dc27" +
  /*s*/ "08b8b2c22e224c99280cd25e5e8bfb40e3d1c55b8c41774e287c1e2c352aecfc" +
  /*v*/ "01" +
  /*guardian*/ "0b" +
  /*r*/ "89c1e85faa20a30601964ccc6a79c0ae53cfd26fb10863db37783428cd91390a" +
  /*s*/ "163346558239db3cd9d420cfe423a0df84c84399790e2e308011b4b63e6b8015" +
  /*v*/ "01" +
  /*guardian*/ "0c" +
  /*r*/ "a31dcb564ac81a053a268d8090e72097f94f366711d0c5d13815af1ec7d47e66" +
  /*s*/ "2e2d1bde22678113d15963da100b668ba26c0c325970d07114b83c5698f46097" +
  /*v*/ "01" +
  /*guardian*/ "0d" +
  /*r*/ "c9fda39c0d592d9ed92cd22b5425cc6b37430e236f02d0d1f8a2ef45a00bde26" +
  /*s*/ "223c0a6eb363c8b25fd3bf57234a1d9364976cefb8360e755a267cbbb674b395" +
  /*v*/ "01" +
  /*guardian*/ "10" +
  /*r*/ "8db01e444ab1003dd8b6c96f8eb77958b40ba7a85fefecf32ad00b7a47c0ae75" +
  /*s*/ "24216262495977e09c0989dd50f280c21453d3756843608eacd17f4fdfe47600" +
  /*v*/ "00" +
  /*guardian*/ "12" +
  /*r*/ "61025228ef5af837cb060bcd986fcfa84ccef75b3fa100468cfd24e7fadf9916" +
  /*s*/ "3938f3b841a33496c2706d0208faab088bd155b2e20fd74c625bb1cc8c43677a" +
  /*v*/ "01" +
  /*timestamp*/ "63c53c40" +
  /*nonce*/ "9e0c5dfa" +
  /*emitterChain*/ "0001" +
  /*emitterAddress*/ "0000000000000000000000000000000000000000000000000000000000000004" +
  /*seqeuence*/ "6c5a054d7833d1e4" +
  /*consistencyLevel*/ "20" +
  /*module*/ "00000000000000000000000000000000000000000000000000000000436f7265" +
  /*action*/ "02" +
  /*chain*/ "0000" +
  /*guardianSet*/ "00000003" +
  /*guardians*/ "13" +
  /*guardian*/ "58cc3ae5c097b213ce3c81979e1b9f9570746aa5" +
  /*guardian*/ "ff6cb952589bde862c25ef4392132fb9d4a42157" +
  /*guardian*/ "114de8460193bdf3a2fcf81f86a09765f4762fd1" +
  /*guardian*/ "107a0086b32d7a0977926a205131d8731d39cbeb" +
  /*guardian*/ "8c82b2fd82faed2711d59af0f2499d16e726f6b2" +
  /*guardian*/ "11b39756c042441be6d8650b69b54ebe715e2343" +
  /*guardian*/ "54ce5b4d348fb74b958e8966e2ec3dbd4958a7cd" +
  /*guardian*/ "15e7caf07c4e3dc8e7c469f92c8cd88fb8005a20" +
  /*guardian*/ "74a3bf913953d695260d88bc1aa25a4eee363ef0" +
  /*guardian*/ "000ac0076727b35fbea2dac28fee5ccb0fea768e" +
  /*guardian*/ "af45ced136b9d9e24903464ae889f5c8a723fc14" +
  /*guardian*/ "f93124b7c738843cbb89e864c862c38cddcccf95" +
  /*guardian*/ "d2cc37a4dc036a8d232b48f62cdd4731412f4890" +
  /*guardian*/ "da798f6896a3331f64b48c12d1d57fd9cbe70811" +
  /*guardian*/ "71aa1be1d36cafe3867910f99c09e347899c19c3" +
  /*guardian*/ "8192b6e7387ccd768277c17dab1b7a5027c0b3cf" +
  /*guardian*/ "178e21ad2e77ae06711549cfbb1f9c7a9d8096e8" +
  /*guardian*/ "5e1487f35515d02a92753504a8d75471b9f49edb" +
  /*guardian*/ "6fbebc898f403e4773e95feb15e80c9a99c8348d";

describe("Governance VAA tests", function () {
  const governanceDiscriminator = payloadDiscriminator([
    ["WormholeCore",
      ["UpgradeContract", "GuardianSetUpgrade", "SetMessageFee", "TransferFees", "RecoverChainId"]
    ],
    ["TokenBridge",
      ["RegisterChain", "UpgradeContract", "RecoverChainId"]
    ],
    ["NftBridge",
      ["RegisterChain", "UpgradeContract", "RecoverChainId"]
    ],
    ["Relayer",
      ["RegisterChain", "UpgradeContract", "UpdateDefaultProvider"]
    ],
    ["CircleBridge",
      ["UpdateFinality", "RegisterEmitterAndDomain", "UpgradeContract"]
    ]
  ]);

  it("should create an empty VAA from an object with omitted fixed values", function () {
    const vaa = createVAA("WormholeCore:UpgradeContract", {
      guardianSet: 0,
      signatures: [],
      nonce: 0,
      timestamp: 0,
      sequence: 0n,
      emitterChain: "Solana",
      emitterAddress: new UniversalAddress(new Uint8Array(32)),
      consistencyLevel: 0,
      payload: {
        chain: "Ethereum",
        //@ts-ignore
        newContract: new UniversalAddress(new Uint8Array(32)),
      },
    });

    expect(vaa.payload.protocol).toEqual("WormholeCore");
    expect(vaa.payload.action).toEqual("UpgradeContract");
  });

  it("should correctly deserialize and reserialize a guardian set upgrade VAA", function () {
    const rawvaa = deserialize("Uint8Array", guardianSetUpgrade);
    expect(governanceDiscriminator(rawvaa.payload)).toBe("WormholeCore:GuardianSetUpgrade");
    const payload = deserializePayload("WormholeCore:GuardianSetUpgrade", rawvaa.payload);
    const vaa = deserialize("WormholeCore:GuardianSetUpgrade", guardianSetUpgrade);
    expect(vaa.payload).toEqual(payload);
    expect(vaa.payloadLiteral).toBe("WormholeCore:GuardianSetUpgrade");
    expect(vaa.guardianSet).toBe(2);
    expect(vaa.signatures.length).toBe(13);
    expect(vaa.nonce).toBe(2651610618);
    expect(vaa.emitterChain).toBe("Solana");
    expect(vaa.payload.protocol).toBe("WormholeCore");
    expect(vaa.payload.action).toBe("GuardianSetUpgrade");
    expect(vaa.payload.guardianSet).toBe(3);
    expect(vaa.payload.guardians.length).toBe(19);

    expect(serialize(vaa))
      .toEqual(encoding.hex.decode(guardianSetUpgrade));
    expect(blindDeserializePayload(rawvaa.payload))
      .toEqual([["WormholeCore:GuardianSetUpgrade", vaa.payload]]);
  });
});
