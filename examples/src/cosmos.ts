import {
  Wormhole,
  TokenId,
  GatewayTransfer,
  GatewayTransferDetails,
} from "@wormhole-foundation/connect-sdk";
// Import the platform specific packages
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { CosmwasmPlatform } from "@wormhole-foundation/connect-sdk-cosmwasm";
// helpers
import { TransferStuff, getStuff } from "./helpers";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform, CosmwasmPlatform]);

  // We're going to transfer Avax from Avalanche into Cosmos through the Gateway
  // then Transfer between chains using IBC and finally transfer out of Cosmos
  // back to Avalanche

  // Grab chain Contexts for each leg of our journey
  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const leg1 = await getStuff(wh.getChain("Avalanche"));
  const leg2 = await getStuff(wh.getChain("Cosmoshub"));
  const leg3 = await getStuff(wh.getChain("Osmosis"));

  // we'll use the native token on the source chain
  const token = "native";
  const amount = 1_000_000_000n;

  // Transfer native token from source chain, through gateway, to a cosmos chain
  const route1 = await transferIntoCosmos(wh, token, amount, leg1, leg2);

  // Transfer Gateway factory token over IBC back through gateway to destination chain
  const route2 = await transferBetweenCosmos(
    wh,
    route1.transfer.token as TokenId,
    route1.transfer.amount,
    leg2,
    leg3
  );

  // Transfer Gateway factory token through gateway back to source chain
  const route3 = await transferOutOfCosmos(
    wh,
    route2.transfer.token as TokenId,
    route2.transfer.amount,
    leg3,
    leg1
  );

  console.log("Transfer into Cosmos: ", route1);
  console.log("Transfer within Cosmos: ", route2);
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

  // TODO: log wait until its complete
  // await xfer.wait()

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

  // TODO: log wait until its complete
  // await xfer.wait();

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
