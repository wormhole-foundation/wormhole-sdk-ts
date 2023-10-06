import {
  GatewayTransfer,
  GatewayTransferDetails,
  TokenId,
  Wormhole,
} from "@wormhole-foundation/connect-sdk";
// Import the platform specific packages
import {
  CosmwasmPlatform,
  Gateway,
} from "@wormhole-foundation/connect-sdk-cosmwasm";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";

import { TransferStuff, getStuff } from "./helpers";

// We're going to transfer into, around, and out of the Cosmos ecosystem
// First on Avalanche, transparently through gateway and over IBC to Cosmoshub
// Then over IBC, transparently through gateway and over IBC to Osmosis
// Finally out of Osmosis, transparently through gateway, out to Avalanche

// eg:
//  Avalanche[avax] => {Gateway} -> Cosmoshub[gateway/wrapped avax]
//  Cosmoshub[gateway/wrapped avax] -> {Gateway} -> Osmosis[gateway/wrapped avax]
//  Osmosis[gateway/wrapped avax] -> {Gateway} => Avalanch[avax]

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform, CosmwasmPlatform]);

  // Grab chain Contexts for each leg of our journey
  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const leg1 = await getStuff(wh.getChain("Avalanche"));
  const leg2 = await getStuff(wh.getChain("Cosmoshub"));
  const leg3 = await getStuff(wh.getChain("Osmosis"));

  // we'll use the native token on the source chain
  const token = "native";
  const amount = await wh.normalizeAmount(leg1.chain.chain, token, 0.01);

  //const wc = wh.getChain("Wormchain");
  //const rpc = (await wc.getRpc()) as CosmWasmClient;
  //const results = await rpc.searchTx([
  //  { key: "wasm.action", value: "complete_transfer_with_payload" },
  //]);
  //const flat = results
  //  .map((r) => JSON.parse(r.rawLog)[0].events)
  //  .flatMap((el) => el);
  //flat.forEach((e) => {
  //  console.log(e.type);
  //  e.attributes.forEach((a: any) => {
  //    console.log(a.key, a.value);
  //  });
  //});

  //return;

  // Transfer native token from source chain, through gateway, to a cosmos chain
  //const route1 = await transferIntoCosmos(wh, token, amount, leg1, leg2);
  const route1 = await GatewayTransfer.from(wh, {
    chain: leg1.chain.chain,
    txid: "0xba40ed516476a00c3eb4673b008888de81e994721e9fce1d62454eb3c29b4284",
  });
  console.log("Route 1 (!Cosmos => Cosmos)", route1);

  // Lookup the Gateway representation of the wrappd token
  const cosmosTokenAddress = await Gateway.getWrappedAsset(
    route1.transfer.token !== "native"
      ? route1.transfer.token
      : {
          chain: leg1.chain.chain,
          address: await (await leg1.chain.getTokenBridge()).getWrappedNative(),
        }
  );

  console.log("Wrapped Token: ", cosmosTokenAddress.toString());
  return;

  // // Transfer Gateway factory tokens over IBC through gateway to another Cosmos chain
  // const route2 = await transferBetweenCosmos(
  //   wh,
  //   { chain: leg2.chain.chain, address: cosmosTokenAddress },
  //   1000n,
  //   leg2,
  //   leg3
  // );
  // console.log("Route 2 (Cosmos -> Cosmos): ", route2);

  // Transfer Gateway factory token through gateway back to source chain
  const route3 = await transferOutOfCosmos(
    wh,
    { chain: leg2.chain.chain, address: cosmosTokenAddress },
    1000n,
    leg2,
    leg1
  );
  console.log("Route 3 (Cosmos => !Cosmos): ", route3);
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

  const attests = await xfer.fetchAttestation();
  console.log("Got Attestations", attests);

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

  const attests = await xfer.fetchAttestation();
  console.log("Got attests: ", attests);

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

  const attests = await xfer.fetchAttestation();
  console.log("Got attests", attests);

  // Since we're leaving cosmos, this is required to complete the transfer
  const dstTxIds = await xfer.completeTransfer(dst.signer);
  console.log("Completed transfer on destination chain", dstTxIds);

  return xfer;
}
