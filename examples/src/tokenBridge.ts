import type { Chain, Network, TokenId } from "@wormhole-foundation/sdk";
import { TokenTransfer, Wormhole, amount, isTokenId, wormhole } from "@wormhole-foundation/sdk";

// Import the platform-specific packages

import evm from "@wormhole-foundation/sdk/evm";
import solana from "@wormhole-foundation/sdk/solana";
import sui from "@wormhole-foundation/sdk/sui";
import type { SignerStuff } from "./helpers/index.js";
import { getSigner, waitLog } from "./helpers/index.js";

(async function () {
  // Init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = await wormhole("Testnet", [evm, solana, sui]);

  // Grab chain Contexts -- these hold a reference to a cached rpc client
  // For Sui ExecutorTokenBridge testing, use Sui as source or destination
  const sendChain = wh.getChain("Sui");
  const rcvChain = wh.getChain("Avalanche");

  // Shortcut to allow transferring native gas token
  const token = Wormhole.tokenId(sendChain.chain, "native");

  // A TokenId is just a `{chain, address}` pair and an alias for ChainAddress
  // The `address` field must be a parsed address.
  // You can get a TokenId (or ChainAddress) prepared for you
  // by calling the static `chainAddress` method on the Wormhole class.
  // e.g.
  // wAvax on Solana
  // const token = Wormhole.tokenId("Solana", "3Ftc5hTz9sG4huk79onufGiebJNDMZNL8HYgdMJ9E7JR");
  // wSol on Avax
  // const token = Wormhole.tokenId("Avalanche", "0xb10563644a6AB8948ee6d7f5b0a1fb15AaEa1E03");

  // Normalized given token decimals later but can just pass bigints as base units
  // Note: The Token bridge will dedust past 8 decimals
  // this means any amount specified past that point will be returned
  // to the caller
  const amt = "0.05";

  // Protocol options:
  // - "TokenBridge": Manual transfer requiring VAA redemption on destination
  // - "ExecutorTokenBridge": Transfer using executor service for automatic relaying
  // - "AutomaticTokenBridge": Transfer using legacy relayer service for automatic relaying
  // On the destination side, a wrapped version of the token will be minted
  // to the address specified in the transfer VAA
  // Note: For Sui as source or destination, only ExecutorTokenBridge is supported
  const protocol: TokenTransfer.Protocol = "ExecutorTokenBridge";

  // For AutomaticTokenBridge: The relayer can deliver native gas funds to the destination account
  // The amount specified for native gas will be swapped for the native gas token according
  // to the swap rate provided by the contract, denominated in native gas tokens
  // For ExecutorTokenBridge: Native gas can also be delivered via the executor service
  // @ts-ignore
  const nativeGas = protocol === "AutomaticTokenBridge" ? "0.01" : undefined;

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getSigner(sendChain);
  const destination = await getSigner(rcvChain);

  // Used to normalize the amount to account for the tokens decimals
  const decimals = isTokenId(token)
    ? Number(await wh.getDecimals(token.chain, token.address))
    : sendChain.config.nativeTokenDecimals;

  // Set this to true if you want to perform a round trip transfer
  const roundTrip: boolean = false;

  // Set this to the transfer txid of the initiating transaction to recover a token transfer
  // and attempt to fetch details about its progress.
  let recoverTxid = undefined;
  // recoverTxid = "0xa4e0a2c1c994fe3298b5646dfd5ce92596dc1a589f42e241b7f07501a5a5a39f";

  // Finally create and perform the transfer given the parameters set above
  const xfer = !recoverTxid
    ? // Perform the token transfer
      await tokenTransfer(
        wh,
        {
          token,
          amount: amount.units(amount.parse(amt, decimals)),
          source,
          destination,
          delivery: {
            protocol,
            nativeGas: nativeGas ? amount.units(amount.parse(nativeGas, decimals)) : undefined,
          },
        },
        roundTrip,
      )
    : // Recover the transfer from the originating txid
      await TokenTransfer.from(wh, {
        chain: source.chain.chain,
        txid: recoverTxid,
      });

  const receipt = await waitLog(wh, xfer);

  // Log out the results
  console.log(receipt);
})();

async function tokenTransfer<N extends Network>(
  wh: Wormhole<N>,
  route: {
    token: TokenId;
    amount: bigint;
    source: SignerStuff<N, Chain>;
    destination: SignerStuff<N, Chain>;
    delivery?: {
      protocol: TokenTransfer.Protocol;
      nativeGas?: bigint;
    };
    payload?: Uint8Array;
  },
  roundTrip?: boolean,
): Promise<TokenTransfer<N>> {
  // EXAMPLE_TOKEN_TRANSFER
  // Create a TokenTransfer object to track the state of the transfer over time
  const protocol = route.delivery?.protocol ?? "TokenBridge";
  let xfer: TokenTransfer<N>;

  if (protocol === "TokenBridge") {
    xfer = await wh.tokenTransfer(
      route.token,
      route.amount,
      route.source.address,
      route.destination.address,
      protocol,
      route.payload,
    );
  } else if (protocol === "AutomaticTokenBridge") {
    xfer = await wh.tokenTransfer(
      route.token,
      route.amount,
      route.source.address,
      route.destination.address,
      protocol,
      route.delivery?.nativeGas,
    );
  } else if (protocol === "ExecutorTokenBridge") {
    // ExecutorTokenBridge requires additional setup for msgValue and gasLimit
    xfer = await wh.tokenTransfer(
      route.token,
      route.amount,
      route.source.address,
      route.destination.address,
      protocol,
    );
  } else {
    throw new Error(`Unsupported protocol: ${protocol}`);
  }

  let quote;
  if (xfer.transfer.protocol === "ExecutorTokenBridge") {
    // For ExecutorTokenBridge, we need to estimate msgValue and gasLimit for the destination chain
    // then get a quote with these parameters to obtain the executor quote
    const dstTb = await route.destination.chain.getExecutorTokenBridge();
    const dstToken = await TokenTransfer.lookupDestinationToken(
      route.source.chain,
      route.destination.chain,
      route.token,
    );
    const { msgValue, gasLimit } = await dstTb.estimateMsgValueAndGasLimit(dstToken);
    quote = await TokenTransfer.quoteTransfer(wh, route.source.chain, route.destination.chain, {
      ...xfer.transfer,
      msgValue,
      gasLimit,
    });
    // Attach the executor quote to the transfer details for later use
    xfer.transfer.executorQuote = quote.details.executorQuote;
  } else {
    quote = await TokenTransfer.quoteTransfer(
      wh,
      route.source.chain,
      route.destination.chain,
      xfer.transfer,
    );
  }
  console.log(quote);

  if (xfer.transfer.protocol === "AutomaticTokenBridge" && quote.destinationToken.amount < 0)
    throw "The amount requested is too low to cover the fee and any native gas requested.";

  // 1) Submit the transactions to the source chain, passing a signer to sign any txns
  console.log("Starting transfer");
  const srcTxids = await xfer.initiateTransfer(route.source.signer);
  console.log(`Started transfer: `, srcTxids);

  if (route.delivery?.protocol === "ExecutorTokenBridge") {
    // For ExecutorTokenBridge transfers, we can track the status via the executor API
    // This provides real-time updates on the relay progress
    let retry = 0;
    while (retry < 5) {
      try {
        const [status] = await wh.getExecutorTxStatus(srcTxids.at(-1)!, xfer.fromChain.chain);
        if (status) {
          console.log(`Executor transfer status: `, status);
          break;
        }
      } catch (error) {
        console.error(`Error fetching executor transfer status: `, error);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
      retry++;
    }
  }

  // If using automatic protocols (AutomaticTokenBridge or ExecutorTokenBridge), we're done
  // Manual TokenBridge requires VAA redemption on the destination chain
  if (route.delivery?.protocol !== "TokenBridge") return xfer;

  // 2) Wait for the VAA to be signed and ready (not required for automatic protocols)
  console.log("Getting Attestation");
  const attestIds = await xfer.fetchAttestation(60_000);
  console.log(`Got Attestation: `, attestIds);

  // 3) Redeem the VAA on the dest chain
  console.log("Completing Transfer");
  const destTxids = await xfer.completeTransfer(route.destination.signer);
  console.log(`Completed Transfer: `, destTxids);
  // EXAMPLE_TOKEN_TRANSFER

  // If no need to send back, dip
  if (!roundTrip) return xfer;

  const { destinationToken: token } = quote;
  return await tokenTransfer(wh, {
    ...route,
    token: token.token,
    amount: token.amount,
    source: route.destination,
    destination: route.source,
  });
}
