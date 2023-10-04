import {
  Wormhole,
  TokenId,
  GatewayTransfer,
  GatewayTransferDetails,
} from "@wormhole-foundation/connect-sdk";
// Import the platform specific packages
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import {
  CosmwasmPlatform,
  Gateway,
} from "@wormhole-foundation/connect-sdk-cosmwasm";

import { TransferStuff, getStuff } from "./helpers";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform, CosmwasmPlatform]);

  // We're going to transfer into, around, and out of the Cosmos ecosystem
  // First on Avalanche, transparently through gateway and over IBC to Cosmoshub
  // Then over IBC, transparently through gateway and over IBC to Osmosis
  // Finally out of Osmosis, transparently through gateway, out to Avalanche

  // eg:
  //  Avalanche[avax] => {Gateway} -> Cosmoshub[gateway/wrapped avax]
  //  Cosmoshub[gateway/wrapped avax] -> {Gateway} -> Osmosis[gateway/wrapped avax]
  //  Osmosis[gateway/wrapped avax] -> {Gateway} => Avalanch[avax]

  // Grab chain Contexts for each leg of our journey
  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const leg1 = await getStuff(wh.getChain("Avalanche"));
  const leg2 = await getStuff(wh.getChain("Osmosis"));
  const leg3 = await getStuff(wh.getChain("Cosmoshub"));

  // we'll use the native token on the source chain
  const token = "native";
  const amount = await wh.normalizeAmount(leg1.chain.chain, token, 0.01);

  // Transfer native token from source chain, through gateway, to a cosmos chain
  //const route1 = await transferIntoCosmos(wh, token, amount, leg1, leg2);

  const route1 = await GatewayTransfer.from(wh, {
    chain: leg1.chain.chain,
    txid: "0x018f0c8b4821ad36678ade563782e354dc4cd5f22353e0b7954089dc20d70abb",
  });
  console.log("Transfer into Cosmos: ", route1);
  console.log("Got VAAs", await route1.fetchAttestation());
  console.log("Redeemed?: ", await route1.isVaaRedeemed());
  console.log("IBC Message Details: ", await route1.fetchIbcMessage());

  // Not working below here
  return;

  // Transfer Gateway factory token over IBC back through gateway to destination chain
  const route2 = await transferBetweenCosmos(
    wh,
    route1.transfer.token as TokenId,
    route1.transfer.amount,
    leg2,
    leg3
  );
  console.log("Transfer within Cosmos: ", route2);

  // Transfer Gateway factory token through gateway back to source chain
  const route3 = await transferOutOfCosmos(
    wh,
    route2.transfer.token as TokenId,
    route2.transfer.amount,
    leg3,
    leg1
  );
  console.log("Transfer out of Cosmos: ", route3);
})();

async function transferIntoCosmos(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff
): Promise<GatewayTransfer> {
  console.log(
    `Beginning transfer into Cosmos from ${
      src.chain.chain
    }:${src.address.address.toString()} to ${
      dst.chain.chain
    }:${dst.address.address.toString()}`
  );

  const xfer = await GatewayTransfer.from(wh, {
    token: token,
    amount: amount,
    from: src.address,
    to: dst.address,
  } as GatewayTransferDetails);
  console.log("Created GatewayTransfer: ", xfer);

  const srcTxIds = await xfer.initiateTransfer(src.signer);
  console.log("Started transfer on source chain", srcTxIds);

  const vaa = await xfer.fetchAttestation();
  console.log("Got VAA", vaa);

  console.log(await xfer.isVaaRedeemed());
  console.log(await xfer.fetchIbcMessage());

  //github.com/wormhole-foundation/connect-sdk/blob/cosmos-ibc-cleanup/platforms/cosmwasm/src/protocols/ibc.ts#L122-L184
  // TODO: log wait until its complete
  // await xfer.wait()

  // TODO:
  // - query wormchain for is_redeemed on the vaa
  // - query wormchain ibc to see if its got outstanding commitments

  return xfer;
}

async function transferBetweenCosmos(
  wh: Wormhole,
  token: TokenId,
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff
): Promise<GatewayTransfer> {
  console.log(
    `Beginning transfer within cosmos from ${
      src.chain.chain
    }:${src.address.address.toString()} to ${
      dst.chain.chain
    }:${dst.address.address.toString()}`
  );

  const xfer = await GatewayTransfer.from(wh, {
    token: token,
    amount: amount,
    from: src.address,
    to: dst.address,
  } as GatewayTransferDetails);
  console.log("Created GatewayTransfer: ", xfer);

  const srcTxIds = await xfer.initiateTransfer(src.signer);
  console.log("Started transfer on source chain", srcTxIds);

  const vaa = await xfer.fetchAttestation();
  console.log("Got VAA", vaa);

  // TODO: log wait until its complete
  // await xfer.wait();

  // - query wormchain ibc to see if its got outstanding commitments

  return xfer;
}

async function transferOutOfCosmos(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff
): Promise<GatewayTransfer> {
  console.log(
    `Beginning transfer out of cosmos from ${
      src.chain.chain
    }:${src.address.address.toString()} to ${
      dst.chain.chain
    }:${dst.address.address.toString()}`
  );

  const xfer = await GatewayTransfer.from(wh, {
    token: token,
    amount: amount,
    from: src.address,
    to: dst.address,
  } as GatewayTransferDetails);
  console.log("Created GatewayTransfer: ", xfer);

  const srcTxIds = await xfer.initiateTransfer(src.signer);
  console.log("Started transfer on source chain", srcTxIds);

  const vaa = await xfer.fetchAttestation();
  console.log("Got VAA", vaa);

  // Since we're leaving cosmos, this is required to complete the transfer
  const dstTxIds = await xfer.completeTransfer(dst.signer);
  console.log("Completed transfer on destination chain", dstTxIds);

  return xfer;
}
