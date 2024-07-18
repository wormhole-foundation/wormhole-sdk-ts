import { Wormhole, wormhole } from "@wormhole-foundation/sdk";
import { CosmwasmAddress, CosmwasmPlatform } from "@wormhole-foundation/sdk-cosmwasm";
import cosmwasm from "@wormhole-foundation/sdk/cosmwasm";
import evm from "@wormhole-foundation/sdk/evm";
import solana from "@wormhole-foundation/sdk/solana";

(async function () {
  const wh = await wormhole("Mainnet", [solana, evm, cosmwasm]);

  const chain = wh.getChain("Injective");

  // const wrappedAsset = "wormhole1ml922hnp59jtq9a87arekvx60ezehwlg2v3j5pduplwkenfa68ksgmzxwr";
  // const factoryAddress =
  //   "factory/wormhole14ejqjyq8um4p3xfqj74yld5waqljf88fz25yxnma0cngspxe3les00fpjx/G4b8zJq7EUqVTwgbokQiHyYa5PzhQ1bLiyAeK3Yw9en8";
  // const ibcDenom = "ibc/22B44C7369EED16089B9840ADE399B80D9483B4E459E67643C96C681D7C463D0";
  // console.log(Wormhole.tokenId("Wormchain", wrappedAsset).address);
  // console.log(Wormhole.tokenId("Wormchain", factoryAddress).address);
  // console.log(Wormhole.tokenId("Wormchain", ibcDenom).address);

  const ibcAddress = new CosmwasmAddress(
    "ibc/A8B0B746B5AB736C2D8577259B510D56B8AF598008F68041E3D634BCDE72BE97",
  );
  console.log(await chain.getDecimals(ibcAddress));

  const ibcBridge = await chain.getIbcBridge();
  const gatewayAsset = await ibcBridge.getGatewayAsset(ibcAddress);
  console.log("Gateway asset: ", gatewayAsset.toString());

  const ibcDerived = ibcBridge.getIbcAsset(gatewayAsset);
  console.log("Local asset same?", ibcDerived.toString() === ibcAddress.toString());

  const decimals = await wh.getChain("Wormchain").getDecimals(gatewayAsset);
  console.log(decimals);
})();
