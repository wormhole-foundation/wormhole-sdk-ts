import {
  Chain,
  GatewayTransfer,
  GatewayTransferDetails,
  Network,
  TokenId,
  Wormhole,
  amount,
  load,
  wormhole,
} from "@wormhole-foundation/sdk";

// Import the platform specific packages

import { SignerStuff, getSigner } from "./helpers/index.js";

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
  const wh = await wormhole("Mainnet", load("Evm", "Solana", "Cosmwasm"));
  // Pick up where you left off by updating the txids as you go
  let fakeIt = false;

  // Grab chain Contexts for each leg of our journey
  const external = wh.getChain("Solana");
  const cosmos1 = wh.getChain("Dymension");
  const cosmos2 = wh.getChain("Injective");

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const leg1 = await getSigner(external);
  const leg2 = await getSigner(cosmos1);
  const leg3 = await getSigner(cosmos2);

  // we'll use the native token on the source chain
  const token: TokenId = Wormhole.tokenId(external.chain, "native");
  const amt = amount.units(amount.parse("0.001", external.config.nativeTokenDecimals));

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
          txid: "3014CABA727C8A1BFCBD282095C771ACBAB3B13CC595B702ABFD3A4502315FBD",
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
  src: SignerStuff<Network, Chain>,
  dst: SignerStuff<Network, Chain>,
): Promise<GatewayTransfer<Network>> {
  // EXAMPLE_GATEWAY_INBOUND
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
  // EXAMPLE_GATEWAY_INBOUND

  return xfer;
}

async function transferBetweenCosmos<N extends Network>(
  wh: Wormhole<N>,
  token: TokenId,
  amount: bigint,
  src: SignerStuff<N, Chain>,
  dst: SignerStuff<N, Chain>,
): Promise<GatewayTransfer<N>> {
  // EXAMPLE_GATEWAY_INTERCOSMOS
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
  // EXAMPLE_GATEWAY_INTERCOSMOS

  return xfer;
}

async function transferOutOfCosmos<N extends Network>(
  wh: Wormhole<N>,
  token: TokenId,
  amount: bigint,
  src: SignerStuff<N, Chain>,
  dst: SignerStuff<N, Chain>,
): Promise<GatewayTransfer<N>> {
  // EXAMPLE_GATEWAY_OUTBOUND
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
  // EXAMPLE_GATEWAY_OUTBOUND

  return xfer;
}
