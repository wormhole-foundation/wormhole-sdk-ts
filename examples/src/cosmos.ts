import {
  Network,
  GatewayTransfer,
  GatewayTransferDetails,
  Platform,
  TokenId,
  Wormhole,
  normalizeAmount,
} from "@wormhole-foundation/connect-sdk";
// Import the platform specific packages
import { CosmwasmPlatform, CosmwasmPlatformType } from "@wormhole-foundation/connect-sdk-cosmwasm";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";

import { TransferStuff, getStuff } from "./helpers";

import "@wormhole-foundation/connect-sdk-cosmwasm-core";
import "@wormhole-foundation/connect-sdk-cosmwasm-ibc";
import "@wormhole-foundation/connect-sdk-cosmwasm-tokenbridge";
import "@wormhole-foundation/connect-sdk-evm-core";
import "@wormhole-foundation/connect-sdk-evm-tokenbridge";

// We're going to transfer into, around, and out of the Cosmos ecosystem
// First on Avalanche, transparently through gateway and over IBC to Cosmoshub
// Then over IBC, transparently through gateway and over IBC to Osmosis
// Finally out of Osmosis, transparently through gateway, out to Avalanche

// eg:
//  Avalanche[avax] => {Gateway ->}Osmosis[gateway/wrapped avax]
//  Osmosis[gateway/wrapped avax] -> {Gateway ->} Cosmoshub[gateway/wrapped avax]
//  Cosmoshub[gateway/wrapped avax] -> {Gateway} => Avalanch[avax]

// Key:
//   => : Regular contract call
//   -> : IBC Transfer
//   {*}: Transparently handled by Gateway

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform, CosmwasmPlatform]);

  // Pick up where you left off by updating the txids as you go
  let fakeIt = false;

  // Grab chain Contexts for each leg of our journey
  const external = wh.getChain("Avalanche");
  const cosmos1 = wh.getChain("Osmosis");
  const cosmos2 = wh.getChain("Cosmoshub");

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const leg1 = await getStuff(external);
  const leg2 = await getStuff(cosmos1);
  const leg3 = await getStuff(cosmos2);

  // we'll use the native token on the source chain
  const token = "native";
  const amount = normalizeAmount("0.01", BigInt(external.config.nativeTokenDecimals));

  // Transfer native token from source chain, through gateway, to a cosmos chain
  let route1 = fakeIt
    ? await GatewayTransfer.from(
        wh,
        {
          chain: external.chain,
          txid: "0xb743ba030d731fe4a02a4f56cb3719fb83e8590f108ed78df67bfc7fdd4b61d6",
        },
        600_000,
      )
    : await transferIntoCosmos(wh, token, amount, leg1, leg2);
  console.log("Route 1 (External => Cosmos)", route1);

  const { denom } = route1.ibcTransfers![0]!.data;
  // Lookup the Gateway representation of the wrappd token
  const cosmosTokenAddress = Wormhole.parseAddress("Wormchain", denom);
  //console.log("Wrapped Token: ", cosmosTokenAddress.toString());

  // Transfer Gateway factory tokens over IBC through gateway to another Cosmos chain
  let route2 = fakeIt
    ? await GatewayTransfer.from(
        wh,
        {
          chain: cosmos1.chain,
          txid: "E016E2C7AB5F38925AFE3696598CD880B9E801519D4BD348D3F48B7ECD1FC129",
        },
        600_000,
      )
    : await transferBetweenCosmos(
        wh,
        { chain: cosmos1.chain, address: cosmosTokenAddress },
        1000n,
        leg2,
        leg3,
      );
  console.log("Route 2 (Cosmos -> Cosmos): ", route2);

  // Transfer Gateway factory token through gateway back to source chain
  let route3 = fakeIt
    ? await GatewayTransfer.from(
        wh,
        {
          chain: cosmos2.chain,
          txid: "2DD7887DB74E47753E4A05DC15D76252FA3BA073B3BF0D9402ED5C313FF773EE",
        },
        600_000,
      )
    : await transferOutOfCosmos(
        wh,
        { chain: cosmos2.chain, address: cosmosTokenAddress },
        1000n,
        leg3,
        leg1,
      );
  console.log("Route 3 (Cosmos => External): ", route3);
})();

async function transferIntoCosmos(
  wh: Wormhole<Network>,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff<Network, Platform>,
  dst: TransferStuff<Network, Platform>,
): Promise<GatewayTransfer<Network>> {
  console.log(
    `Beginning transfer into Cosmos from ${src.chain.chain}:${src.address.address.toString()} to ${
      dst.chain.chain
    }:${dst.address.address.toString()}`,
  );

  const xfer = await GatewayTransfer.from(wh, {
    token: token,
    amount: amount,
    from: src.address,
    to: dst.address,
  } as GatewayTransferDetails);
  console.log("Created GatewayTransfer: ", xfer.transfer);

  const srcTxIds = await xfer.initiateTransfer(src.signer);
  console.log("Started transfer on source chain", srcTxIds);

  const attests = await xfer.fetchAttestation(600_000);
  console.log("Got Attestations", attests);

  return xfer;
}

async function transferBetweenCosmos<N extends Network>(
  wh: Wormhole<N>,
  token: TokenId,
  amount: bigint,
  src: TransferStuff<N, CosmwasmPlatformType>,
  dst: TransferStuff<N, CosmwasmPlatformType>,
): Promise<GatewayTransfer<N>> {
  console.log(
    `Beginning transfer within cosmos from ${
      src.chain.chain
    }:${src.address.address.toString()} to ${dst.chain.chain}:${dst.address.address.toString()}`,
  );

  const xfer = await GatewayTransfer.from(wh, {
    token: token,
    amount: amount,
    from: src.address,
    to: dst.address,
  } as GatewayTransferDetails);
  console.log("Created GatewayTransfer: ", xfer.transfer);

  const srcTxIds = await xfer.initiateTransfer(src.signer);
  console.log("Started transfer on source chain", srcTxIds);

  const attests = await xfer.fetchAttestation(60_000);
  console.log("Got attests: ", attests);

  return xfer;
}

async function transferOutOfCosmos<N extends Network>(
  wh: Wormhole<N>,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff<N, CosmwasmPlatformType>,
  dst: TransferStuff<N, Platform>,
): Promise<GatewayTransfer<N>> {
  console.log(
    `Beginning transfer out of cosmos from ${
      src.chain.chain
    }:${src.address.address.toString()} to ${dst.chain.chain}:${dst.address.address.toString()}`,
  );

  const xfer = await GatewayTransfer.from(wh, {
    token: token,
    amount: amount,
    from: src.address,
    to: dst.address,
  } as GatewayTransferDetails);
  console.log("Created GatewayTransfer: ", xfer.transfer);

  const srcTxIds = await xfer.initiateTransfer(src.signer);
  console.log("Started transfer on source chain", srcTxIds);

  const attests = await xfer.fetchAttestation(600_000);
  console.log("Got attests", attests);

  // Since we're leaving cosmos, this is required to complete the transfer
  const dstTxIds = await xfer.completeTransfer(dst.signer);
  console.log("Completed transfer on destination chain", dstTxIds);

  return xfer;
}
