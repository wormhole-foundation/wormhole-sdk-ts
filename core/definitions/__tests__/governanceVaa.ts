import { encoding } from "@wormhole-foundation/sdk-base";
import { UniversalAddress } from "../src/universalAddress.js";
import {
  createVAA,
  deserialize,
  deserializePayload,
  serialize,
  blindDeserializePayload,
  payloadDiscriminator,
} from "./../src/vaa/index.js";
import "../src/protocols/governance/index.js";

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

const governanceDiscriminator = payloadDiscriminator([
  [
    "WormholeCore",
    ["UpgradeContract", "GuardianSetUpgrade", "SetMessageFee", "TransferFees", "RecoverChainId"],
  ],
  ["TokenBridge", ["RegisterChain", "UpgradeContract", "RecoverChainId"]],
  ["NftBridge", ["RegisterChain", "UpgradeContract", "RecoverChainId"]],
  ["Relayer", ["RegisterChain", "UpgradeContract", "UpdateDefaultProvider"]],
  ["CircleBridge", ["UpdateFinality", "RegisterEmitterAndDomain", "UpgradeContract"]],
  ["IbcBridge", ["ActionUpdateChannelChain"]],
  ["IbcReceiver", ["ActionUpdateChannelChain"]],
  ["GlobalAccountant", ["ModifyBalance"]],
  ["GeneralPurposeGovernance", ["GeneralPurposeEvm", "GeneralPurposeSolana"]],
  ["WormchainGovernance", ["StoreCode", "InstantiateContract", "MigrateContract", "AddWasmInstantiateAllowlist", "DeleteWasmInstantiateAllowlist"]],
  ["GatewayGovernance", ["ScheduleUpgrade", "CancelUpgrade", "SetIbcComposabilityMwContract"]],
]);

describe("WH Core governance VAA tests", function () {
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
        actionArgs: {
          newContract: new UniversalAddress(new Uint8Array(32)),
        }
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
    expect(vaa.payload.actionArgs.guardianSet).toBe(3);
    expect(vaa.payload.actionArgs.guardians.length).toBe(19);

    expect(serialize(vaa)).toEqual(encoding.hex.decode(guardianSetUpgrade));
    expect(blindDeserializePayload(rawvaa.payload)).toEqual([
      ["WormholeCore:GuardianSetUpgrade", vaa.payload],
    ]);
  });
});


describe('Wormchain governance VAA tests', () => {
  it('decodes an add wasm instantiate allowlist VAA', () => {
    // 1/0000000000000000000000000000000000000000000000000000000000000004/10121401977384960882
    const vaa = deserialize(
      'WormchainGovernance:AddWasmInstantiateAllowlist',
      Buffer.from('AQAAAAMNAGDD/fbZkCX7Ir/PqPaJEobw+nGvXFN+m9EGfBHT4eUheYKXooRrKWrAcHZXeNFzAaf9s5rM7BnM381gpbVgdB0BA5GfSBln3AbJ5XPk30q6PGADZXcqEmf+SjNXt9gzbcbrJlQ+VQnSnLMn7AG2YHBXnSelw55FNrQ8WPdRVoFdFgEBBWp4CrM7BSh3QyhcG7ohoBkze8q2xqfZKCZxhIinHr0YNZi+0ba2aQjs1u3E2RkUtTRVeJMMmVmeKn1054gp5xoABqIgzw1wATfAK6GulSHGDfze/uwZap73NZxX05Way7IwCsNvATmG5ouG/iv+YLrgBvzlH2hYUNnpmhhW9wrw+hMBCCAWgSRyoAPm7qPKIpMPoF58JvF8lO863+DcCTQyDMqtAAzxUww8IGSJiKIYlyWzGJUkSt2DHouqWdC36eRH4MYACXoi1prEl5VqttbJUOZVBbx4cOmSFnL+RbbYMYOGtJH7UYmQ53BAB8j0XhINz/+Fub8l54zYXOvRyviM+dvDRDUBCqqdYFxX45EzjZ7cTglEJvbgULXH04HQzwiX+oKxRVLhLzaGZYkwi83BC8VWWc8NkT8xPzQFle+NuQqsfBEUXp4BCyRJX1GyvScOPtz+D6EYe/oSKGTErIa84DdBcno1LEYGHEAM41vnS616RoC5NMyer8pRLZlcKz6WWKid3anTyjQBDFD7at7KtUicqdeZ4tDbCVm5OIBJM9I4E/i3mzt4XwFJJdHvvAIKdlrgsj0+l2QxK1NhfZk95i1HK2PDbiJcfgEADcISW8SJBTJ3Hz6W16ZjG0S20a4rJR9RebvVzD73eRHHULCOLWfSyB/4QIBCd6sx9o2kcignW4DnMu8PltOzuEEBDi5hEi6Z/QQlbjZYs+xbk1XbfdVCupElFrhYuwPJKYwUeO3GcRu2EfRkdpYOMMcvImK9/2pLQxNS0CoP6s4XVoAAEBSMpeWTtayCcPUNeJNNQgPaRtZlY33YUwPFs9V71/CJUvMrJ7+ch4MB/9nlRvrGvj6c2D6cs9lOK0CBgBJ9WmEAEp+Hophj6pWtnDPSvYy3YUyPr5oo8LVKSaBhLcxh1XdtGeDL/fBJEWVcUO4JEF23mXKr7fVOeqnZmPU0g4x3sFUBAAAAADup86AAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEjHZxeRL3g3IgAAAAAAAAAAAAAAAAAAAAAAAAAAAAV2FzbWRNb2R1bGUEDCCutTTEXDBJ04C52blm+YlfU6vUMBv6/0B/oJ3qiuepJAAAAAAAAAAH', 'base64')
    );

    expect(vaa.protocolName).toEqual('WormchainGovernance');
    expect(vaa.payload.action).toEqual('AddWasmInstantiateAllowlist');
    expect(vaa.payload.chain).toEqual('Wormchain')
    expect(vaa.payload.actionArgs.contractAddr.toString()).toEqual('0xaeb534c45c3049d380b9d9b966f9895f53abd4301bfaff407fa09dea8ae7a924')
    expect(vaa.payload.actionArgs.codeId).toEqual(7n)
  });
});

describe('CircleIntegration governance VAA tests', () => {
  it('decodes an update finality VAA', () => {
    // 1/0000000000000000000000000000000000000000000000000000000000000004/10902023552031577443
    const vaa = deserialize(
      'CircleBridge:RegisterEmitterAndDomain',
      Buffer.from('AQAAAAMNAlS0TwHata7yWnPfleafAQY4EbL/tUuZNngj8j3v37hnBmbol5aF9s4tKXZK+mdk40TTLoneE0qRBIFwcQxCSKEAAxZlfPgagzE+0zKxA8zUH12jViuqBVZ3E1y6n365g2FdOh9MabB6TJP1RKIwFayzFb0CBMSBGIE/qXzm/Ck8cZMABOsEvVSFQrIdx4rdwmHEJ9BcYW/AMFdvPd4O8DOHhlkyFxFIS2FpauXH3H5jMo4w6f1PGoz03b9WtPkRBDdF838ABi7MCFJh1G8bZAA7o9X2EgbAowUPmIu/Y3Um1kWLAFHHOZwKrU+ZRzoLSruMJ4gG6oWF4zoCOTj9jV34Gz4aBGEBB/NTFvM6sVBnFYtjZFBDBY6ZVX3c0fgLPq9SOhhP0nT6NNIuJMz/6lXb3ceOHxZamU/642EeAmfgXVYCbCLmL5sACdEbOyIKPZyWIDIOO0D9M/uIsb00Z1y8uC9iGI2m298zXY0rnGYMqbJhblfs/0ckWYifS7V8Yqcg9xRCXNanNGYBCvzZs22rTHXAZIiSm36c1pn8i/9peh5bvDhC4YW5NcqjClTLICi09X32+NKUQ4ShbuveUv1CbBXYGNK2s0vNvA4BC0j2N4C6arUOzXk5vRbUxA4IicUsXTgucrWbY1RvtzVnUL3DNHG77BiTLViEE1QDFMLCTE+D+vGcCLBVTp1GnnMBDfeaq3DJcory8Ob66iJ5qSZO7I069SCLNmSfDzuo0l8teKa1d3wit7EK24aLcL3KMeJnszYVrm7F9szOKVHk384BDkraQQANDdXBfGsDmGlUWQ3NRBZU5b7qIJkeNDrtPQS6atCEVNLOBTj8chJULRbrOrHTsaDhTs6/HYEQQMqtliwAD0zNgKUWJg/itSM1oW1O/3He6UuC4VoBDQB3KzanTqbEdaUKYybjY8hKAuamEetPtN3fxWvCc0GdN9BfhxM3B/0BEH8VyP2wez8YGOoKC7DAp2z3YIOqP3dqQMvbdK+ttqH9MQQ6+4kiP+Bw6SFUPl+M2eNLhnJRnYi4LzmNOmrWtloAEWm5YUWdvAxGTtoCrqjur/mXovUfHC4+D1xfhsCtwzPLBziobFw53ZHImf+XDmf1kJQ3hAam3soOsuYIokn2u+oAAAAAAK74C0YAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEl0vEqL/I1WMgAAAAAAAAAAAAAAAAAAAAQ2lyY2xlSW50ZWdyYXRpb24CABgAAgAAAAAAAAAAAAAAAKraBb05k3LwsEY3RMCRE8E3Y29qAAAAAA==', 'base64')
    );

    expect(vaa.protocolName).toEqual('CircleBridge');
    expect(vaa.payload.action).toEqual('RegisterEmitterAndDomain');
    expect(vaa.payload.chain).toEqual('Optimism')
    expect(vaa.payload.actionArgs.emitterChain).toEqual('Ethereum')
    expect(vaa.payload.actionArgs.emitterAddress.toString()).toEqual('0x000000000000000000000000aada05bd399372f0b0463744c09113c137636f6a')
    expect(vaa.payload.actionArgs.domain).toEqual(0)
  });
});

describe('GeneralPurposeGovernance governance VAA tests', () => {
  it('decodes a general purpose EVM VAA', () => {
    // 1/0000000000000000000000000000000000000000000000000000000000000004/13001954670584823858
    const vaa = deserialize(
      'GeneralPurposeGovernance:GeneralPurposeEvm',
      Buffer.from('AQAAAAQNALlAubo5YgZ33iBhWmBQwBcfJijtgTACBrakZ53/8zrmZ5XzGK7jgdsojAvaCG0ULp/7vKCJTGT7Y1/dqiBCytUBAwMiQ8bkGywXnP3lMZck0NgrWb/uQ7kzUXdaVsR8RffOZmbVNC8GqkeBI1DjH9rfqY/MiYK/gIZdZ4kQIxCorTgABVj9WRVVSphAqlPYoMm6QcgttinkmvRFZDA9n7ioWPseSm7UTbr1Orxka+E1hS5vx50WMiNDNLPUxxfh0jFzvUIABjSai4evOMPdOrPKL6ij8/oAq3SRcF6LY452hSza3oa+cdJdC741H+zuS3Wt8Stcx1rytmlgLj7fou+4g6uUJXAABzpTyTvnFFOc16ZNSojTbp2pkmzC/Y3D1q79KlJ0LtRWWUCpWmK+W53i91ov4X17+AgWCluwDtyNNXXGUzj7BGYBCiSvZkZfiny4lnfSHpUWwSeyVddnCQbuCbaFb+83c6l0T9VxOhRXCzIETnNHJL4+YeS5ctRAc0vYnxhsGtpbeQYACzpclWE2u892rP+BpQJlb2F/gnqmMY6dZI6T190hoe/qbnZHIsZl5Mltt77hbNX/9f1rHCr+DsInMmYB/8A8wbYBDAC30j9VTU5rK/oTmV70NthMrUAlU/pJO9twLf+5Kvz5KKkwtG7+ledarbsEVliTnPZzMPPUQlCyE6jLYrNYrTABDd75ZkcKyb3sbyU+jYgRoJKEUdu2pK9+zt+1lFFagmsNHPGvlTxN5iyZPcYZuGpDzgUusmvduj8Mv6g9d+yTw8EBDj7BJ756tj3edrB0OXXAOVGQCZv+iVMmZjcRmTCvcw8UIJG38rhRBbPyefesVHOWh8K5Sd6sIryrMi1nkDGNqaoBEOaqnGVfFN5hag5XziuOesMmeofY8qCzGaeMyK7ObmILEUDrhZHss3jVaNfaCISBXaG8tc4/ig2pfuTvOR4AAQgBEcmjyx+s6t2d3CGSvlP1ArR6W7X44zsNUTctM8+BGV0ANEFO9AJ3l3qBhd12guV8SV6z7pTWqmfvNlTRmP1tqewBEn4n8ocCIfEXtLH0UK2aRa0jaibrwFedBwGysKkAI8NXfJVCIqyi/jPP97ghFkkRZFMyPaiwKzLLnKJHJ9ILXfcAAAAAAIpC21wAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEtHA44rXwgDIgAAAAAAAAAABHZW5lcmFsUHVycG9zZUdvdmVybmFuY2UBAAIj/qVRTfyYIUefvhi6HX4aYfb/z8Bysa7zNu3eWaBJaZ706PqdWUpIAEQYbOYSAAAAAAAAAAAAAAAAAAAAAAAAAAAAUrfS3MgM0uQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQ==', 'base64')
    );

    expect(vaa.protocolName).toEqual('GeneralPurposeGovernance');
    expect(vaa.payload.action).toEqual('GeneralPurposeEvm');
    expect(vaa.payload.chain).toEqual('Ethereum')
    expect(vaa.payload.actionArgs.governanceContract.toString()).toEqual('0x23fea5514dfc9821479fbe18ba1d7e1a61f6ffcf')
    expect(vaa.payload.actionArgs.targetContract.toString()).toEqual('0xc072b1aef336edde59a049699ef4e8fa9d594a48')
    expect(encoding.hex.encode(vaa.payload.actionArgs.payload)).toEqual('186ce61200000000000000000000000000000000000000000052b7d2dcc80cd2e40000000000000000000000000000000000000000000000000000000000000000000001')
  });
});

describe('GlobalAccountant governance VAA tests', () => {
  it('decodes a modify balance VAA', () => {
    // 1/0000000000000000000000000000000000000000000000000000000000000004/1355529820690165473
    const vaa = deserialize(
      'GlobalAccountant:ModifyBalance',
      Buffer.from('AQAAAAMNAwFLtgbSiISxVEvMuVl66GaNdRjP/XffoimkZIW7EhauY6S4IVNTwIAT6emutu/ETf0c9OIAnwhc5fYX6JyKLhYABG0+PuPys2VpK5pxhxICqsDdbjiy3NxOnAP8weFhykRpD69yM4x0I8X2hk9tY5pd8h8OENlI7H1jiteXNQbd3ggBBdVwN9n8MBst12pbyLzqEBpJXciHglxyVK+DkSUv8kiSM3fJERjEWVTI0KJVgyTxr8tbIHgVwl0g2PKk+IEMMXwABotiFe2+55eiEOKUI4PLvPNm59owPW6s5WfT4UCOOeYrAbiq9o0pEsRF9zYYAqanoHMd0P0KgUkyGExiHO2YVroACGtF+WAMj6JczXe7zjqKCn8/u2fP6yWxEZO8MbL6nFpRerAUy+Pbltnm1T5BURY9yPCDieuPlg5Jr+rmPXyxE/gBCd5wM6ZbDzRdnxaor+4xxlGazayZCzy4QkPmJp7hM2FYUswaLkzfPOh9h96MNy0sZY0PMkXKQS0bHH9/wS6S+K4ACoC1ZcybNyEYievSOApE4B8is2OANByINXPR3nH61jWCeh6JIi6n/BczptIaFCsBFNdGYl1ZgGVbvOjWT5GQTwEBDWL+TsFXCHA+iE/kaJJ8GQdOUb5wpjmyeTvixrTzwyEAeUNAqfAfM62L+zo5vKE9gYVLErl3YHJISyzLjXS2BSwBDuD0b9wmyeL+lp1JRDnoByaltXKoejgtFE0UG6K+bgLEHN9ets1npg8ZoiYBSHe3heS6ACk7AbzgqdTUqgVJIoYBD7oJgB5vD3xSg2P2qZVfDcuL9uwdP9J/mFsczTvY2vCiSCxfG3LtogvvGxsaZtIfoBJlMweuGWm3tgLjIFvHpxYAEOE0KNosm5Osc7Cg0EX5hWarsRRE+7b16+PPhWwF9qCheSLKQ/C4PFEIhkmiw/12qrKym8A/6SfZQV+8mzIcuBUAEciRvYsoAqQu7E/JDwloGnfgHwy/mR9Op+utHZCbxpQaOO2gDfj8lF/YItlUc2MgPM+z28doZhQzvzjvU2hSV28AEjODEpLLexKsdqRhWumMTk0suU1q7qV9A/+ioyMJMT/IdTuug+rN2aDEIPLVgYDT/O6Sx73llIlmNHToe3nqbdYAAAAAAA07xd0AAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEEs/PMKSvruEgAAAAAAAAAAAAAAAAAAAAAEdsb2JhbEFjY291bnRhbnQBDCAAAAAAAAAAAwABAAIAAAAAAAAAAAAAAADAKqo5siP+jQoOXE8n6tkIPHVswgEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAArp97zAACAgICAgICAgICAgICAgICAgICAAAAAAAAAAAAAAAAAA', 'base64')
    );

    expect(vaa.protocolName).toEqual('GlobalAccountant');
    expect(vaa.payload.action).toEqual('ModifyBalance');
    expect(vaa.payload.chain).toEqual('Wormchain')
    expect(vaa.payload.actionArgs.sequence).toEqual(3n)
    expect(vaa.payload.actionArgs.modifiedChain).toEqual('Solana')
    expect(vaa.payload.actionArgs.tokenChain).toEqual('Ethereum')
    expect(vaa.payload.actionArgs.tokenAddress.toString()).toEqual('0x000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')
    expect(vaa.payload.actionArgs.kind).toEqual('Add')
    expect(vaa.payload.actionArgs.amount).toEqual(12000000000000n)
    expect(vaa.payload.actionArgs.reason).toEqual(
      String.fromCharCode(...(Buffer.from('2020202020202020202020202020202020202000000000000000000000000000', 'hex')))
    )
  });
});

describe('IbcTranslator governance VAA tests', () => {
  it('decodes an update channel VAA', () => {
    // 1/0000000000000000000000000000000000000000000000000000000000000004/12204827889220539192
    const vaa = deserialize(
      'IbcBridge:ActionUpdateChannelChain',
      Buffer.from('AQAAAAMNAfG1Ll6XohSBsZI3m0MJXrr/2/YLwZHH82dDpwV4U9cwIzIr759SQwZ15jO3ph5wOJ6fu7sfM5TXY9CgIup9SLUBAp/EsEaCvBE9DKczqqYbUgjTDDDT99QRIYHm/AUGCF1Pf8t55F2G+lmeB/y0t7bECT44rzmmKi043YqRamaNpYcBBeNu9UbmfVsgIVu/OmpilsfIiMcBKbv67gmuXhbQO32vN4Ag0oWw9lvrq1WXvEFGZIkmARjAQJQNrB1+UOcICxwBBpO9xokBhmCPgbz5UeTm4rfSkIFn0hKDHqk7S1Z9Yn07MTn9rcOtewvAqvVtqJ2Dw9ps9vYxclrGcywbpU/Cg8cAB9G6QM8N90+htczrfKuAXhTgrSOdcg3RH1n4WTuMf1mhe3f2R9x/ZcQXIuj8U56QJ0cPRQkd8/m5GBD0pHAeTmUBCOrOypT0AMviFPjx5CXEpEEFFGkSZVD39+nzuYNMm4XIHYVvl6tBMIR8PsT8ru8VRUqRvhivmz9HEVCRfBz0odYACan5mFweKaHj4kkYGszoVs3+6cjFBdBtr1/6DgSi8Z7ObrT4dUHQTOCUaGBTOAisMcqHyBNSpF6EpgXgq7r/AAkBC8iOKy4s9YPz/HMtsBWcg+zC9zJ4G7D2ZPBeOPSalTn8QxbKiP2LwekZrVK5rmnVgk8ROMJa/qdCvntmg/kY5j0BDdIjQT2xrcqgWp25iRd7WXAp8607qinIFjKQIiNBX9rmEs7uKTxjHHw8Xqe6qroJ+Byokx2c3KSZq0XdFRb+9McADm7ak1RV2tlr3ZurJnpkSLl/4VQTqAfpOxZonWZWdccxd9HF/YOAW9+prYlHSa9RRArRcYmRP9bPQFxo2S4mM3EAD9VBC+RtEa+gMCxf+UKXzz7FCrfEQR313Gfqo1wWzhBjGu490tPK3f/0CBmdn0UvZvQ+W1oPU3tFO/nod/UWbB8BENxG5GAGra5+xNnLIChK1fk/+y1PQf+54o9mZi/69Jj9T7bD/Tomv8pg5129vXS1GNJHRxu69epLH6KhPSoLI3QBEZ1Nfx163ojjscR58bNGVzfK0bhAA+VCCqOGaILzRhoMWUR/ofW5QfyULUFxu51vPjQ0Hx5df18vyZ1uOZ8I2b0AAAAAAEJEv3wAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEqWBCTSHFUzggAAAAAAAAAAAAAAAAAAAAAAAAAEliY1RyYW5zbGF0b3IBDCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjaGFubmVsLTEyD6U=', 'base64')
    );

    expect(vaa.protocolName).toEqual('IbcBridge');
    expect(vaa.payload.action).toEqual('ActionUpdateChannelChain');
    expect(vaa.payload.chain).toEqual('Wormchain')
    expect(vaa.payload.actionArgs.channelId.length).toEqual('channel-12'.length)
    expect(vaa.payload.actionArgs.channelChain).toEqual('Stargaze')
  });
});

describe.skip('Gateway governance VAA tests', () => {
  it('decodes a schedule update VAA', () => {
    const raw = serialize(createVAA("Uint8Array", {
      guardianSet: 0,
      signatures: [],
      nonce: 0,
      timestamp: 0,
      sequence: 0n,
      emitterChain: "Solana",
      emitterAddress: new UniversalAddress(new Uint8Array(32)),
      consistencyLevel: 0,
      payload: Buffer.from(
        "00000000000000000000000000000000000000476174657761794d6f64756c65" + // "GatewayModule"
        "01" + // ScheduleUpgrade action
        "0c20" + // wormchain chain id (3104)
        "55706772616465436f6e7472616374" + // "UpgradeContract"
        "0000000012345678" // height
      , 'hex'),
    }));

    const vaa = deserialize('GatewayGovernance:ScheduleUpgrade', raw);

    expect(vaa.protocolName).toEqual('GatewayGovernance');
    expect(vaa.payload.action).toEqual('ScheduleUpgrade');
    expect(vaa.payload.chain).toEqual('Wormchain')
    expect(vaa.payload.actionArgs.name).toEqual('UpgradeContract')
    expect(vaa.payload.actionArgs.height).toEqual(305419896n)
  });
});
