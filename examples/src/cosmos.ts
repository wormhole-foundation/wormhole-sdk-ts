import {
  Chain,
  GatewayTransfer,
  GatewayTransferDetails,
  Network,
  TokenId,
  Wormhole,
  amount,
} from "@wormhole-foundation/connect-sdk";
// Import the platform specific packages
import { CosmwasmPlatform } from "@wormhole-foundation/connect-sdk-cosmwasm";
import { computeFee } from "@wormhole-foundation/connect-sdk-cosmwasm/src/unsignedTransaction";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

import { TransferStuff, getStuff } from "./helpers";

import "@wormhole-foundation/connect-sdk-cosmwasm-ibc";
import "@wormhole-foundation/connect-sdk-cosmwasm-tokenbridge";
import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";

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
  const wh = new Wormhole("Mainnet", [EvmPlatform, SolanaPlatform, CosmwasmPlatform]);
  // Pick up where you left off by updating the txids as you go
  let fakeIt = false;

  console.log(computeFee("Mainnet", "Dymension"));

  // Grab chain Contexts for each leg of our journey
  const external = wh.getChain("Solana");
  const cosmos1 = wh.getChain("Dymension");
  const cosmos2 = wh.getChain("Injective");

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const leg1 = await getStuff(external);
  const leg2 = await getStuff(cosmos1);
  const leg3 = await getStuff(cosmos2);

  // we'll use the native token on the source chain
  const token: TokenId = Wormhole.tokenId(external.chain, "native");
  const amt = amount.units(amount.parse("0.001", external.config.nativeTokenDecimals));

  fakeIt = true;
  // Transfer native token from source chain, through gateway, to a cosmos chain
  let route1 = fakeIt
    ? await GatewayTransfer.from(
        wh,
        {
          chain: external.chain,
          txid: "5y2BnJ1Nwqe4m6KTSrry5Ni88xqVrqo4jdbuNwAPDuXEonQRVLbALf7abViwucKKr8U8cDfJtDmqnuRAAC6i6wtb",
        },
        600_000,
      )
    : await transferIntoCosmos(wh, token, amt, leg1, leg2);
  console.log("Route 1 (External => Cosmos)", route1);

  // Lookup the Gateway representation of the wrappd token
  const { denom } = route1.ibcTransfers![0]!.data;
  const cosmosTokenAddress = Wormhole.parseAddress("Wormchain", denom);

  // Transfer Gateway factory tokens over IBC through gateway to another Cosmos chain
  let route2 = fakeIt
    ? await GatewayTransfer.from(
        wh,
        {
          chain: cosmos1.chain,
          txid: "44338C505E843E993EC8F2548979C0E12A971CEFFC3DD3FDA1D3155B4D440E06",
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

  fakeIt = false;

  // Transfer Gateway factory token through gateway back to source chain
  let route3 = fakeIt
    ? await GatewayTransfer.from(
        wh,
        {
          chain: cosmos2.chain,
          txid: "BEDD0CE2FEA8FF5DF81FCA5142E72745E154F87D496CDA147FC4D5D46A7C7D81",
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
  token: TokenId,
  amount: bigint,
  src: TransferStuff<Network, Chain>,
  dst: TransferStuff<Network, Chain>,
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
  src: TransferStuff<N, Chain>,
  dst: TransferStuff<N, Chain>,
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
  token: TokenId,
  amount: bigint,
  src: TransferStuff<N, Chain>,
  dst: TransferStuff<N, Chain>,
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
