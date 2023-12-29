import {
  Chain,
  Network,
  Platform,
  TokenId,
  TokenTransfer,
  TransferState,
  Wormhole,
  isTokenId,
  normalizeAmount,
} from "@wormhole-foundation/connect-sdk";
import { TransferStuff, getStuff } from "./helpers";

// Import the platform specific packages
import { AlgorandPlatform } from "@wormhole-foundation/connect-sdk-algorand";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

// Register the protocols
import "@wormhole-foundation/connect-sdk-algorand-tokenbridge";
import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";

/*
#  Scenario                                                       | Status | TxID
1. Algorand native ALGO to other chain                            | OK     | NK7DK5CLRU2HWNHFNBNFCLM5RLNBVICBUYEW6FBEQVMCVFBBG7JA
2. Return wrapped ALGO from other chain to Algorand native ALGO   | FAIL   | 4JGo9dwVv8XVTyf9CDXzX5QD4aBc4ZB6sHF7wFqw5LNLstqkRFmumwvu8HATddBVDcybKAAvrACfw1UEw3TD122b
3. Algorand ASA to other chain                                    | OK_Ava | BNRWXLRWR7FVYMBBWHNWWCF65YQBDJAHVA5AMWADEC6K3WH76VYQ
4. Return wrapped token from other chain to original Algorand ASA | FAIL   | 0x0dc8e8a052de3c62cda7d8a8211ac49c3c2c43d8841ee462e309c3d1abccbda4
5. Other chain native asset orand wrapped token                   | OK     | 4wapEufhVAtv8oRqdrRzEovBHKkJDDD3m2pf1Jq3XtpvFwqA2YUijFqFufrGNyxY54vohmy3tsXCb2frcuBNa61T
6. Return Algorand wrapped token to other chain native asset      | OK     | TD5OWVV6BED5VFAGXBUWVITW6EX3KYOPXEJQLGMFIXM3JJ75HULQ
7. Other chain token to Algorand wrapped token                    |        | 
8. Return Algorand wrapped token to other chain token             |        | 
*/

(async function () {
  // Init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [AlgorandPlatform, EvmPlatform, SolanaPlatform]);

  // Grab chain Contexts -- these hold a reference to a cached rpc client
  const sendChain = wh.getChain("Algorand");
  const rcvChain = wh.getChain("Solana");

  // Shortcut to allow transferring native gas token
  //const token: TokenId | "native" = "native";

  const token = Wormhole.chainAddress("Algorand", "10458941"); // USDC on Algorand
  // const token = Wormhole.chainAddress("Avalanche", "0x12EB0d635FD4C5692d779755Ba82b33F6439fc73"); // wUSDC on Avalanche
  // const token = Wormhole.chainAddress("Algorand", "86897238"); // wSOL on Algorand
  // const token = Wormhole.chainAddress("Solana", "9rU2jFrzA5zDDmt9yR7vEABvXCUNJ1YgGigdTb9oCaTv"); // wALGO on Solana

  // Normalized given token decimals later but can just pass bigints as base units
  // Note: The Token bridge will dedust past 8 decimals
  // this means any amount specified past that point will be returned
  // to the caller
  const amount = "0.00001";

  // With automatic set to true, perform an automatic transfer. This will invoke a relayer
  // contract intermediary that knows to pick up the transfers
  // With automatic set to false, perform a manual transfer from source to destination
  // of the token
  // On the destination side, a wrapped version of the token will be minted
  // to the address specified in the transfer VAA
  const automatic = false;

  // The automatic relayer has the ability to deliver some native gas funds to the destination account
  // The amount specified for native gas will be swapped for the native gas token according
  // to the swap rate provided by the contract, denominated in native gas tokens
  const nativeGas = automatic ? "0.01" : undefined;

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getStuff(sendChain);
  const destination = await getStuff(rcvChain);

  // Used to normalize the amount to account for the tokens decimals
  // Used to normalize the amount to account for the tokens decimals
  const decimals = isTokenId(token)
    ? await wh.getDecimals(token.chain, token.address)
    : BigInt(sendChain.config.nativeTokenDecimals);

  // Set this to the transfer txid of the initiating transaction to recover a token transfer
  // and attempt to fetch details about its progress.
  let recoverTxid = undefined;
  // recoverTxid =
  //   "4JGo9dwVv8XVTyf9CDXzX5QD4aBc4ZB6sHF7wFqw5LNLstqkRFmumwvu8HATddBVDcybKAAvrACfw1UEw3TD122b"; // Recover scenario 2
  // recoverTxid =
  //   "0x0dc8e8a052de3c62cda7d8a8211ac49c3c2c43d8841ee462e309c3d1abccbda4"; // Recover scenario 4

  // Finally create and perform the transfer given the parameters set above
  const xfer = !recoverTxid
    ? // Perform the token transfer
      await tokenTransfer(wh, {
        token,
        amount: normalizeAmount(amount, decimals),
        source,
        destination,
        delivery: {
          automatic,
          nativeGas: nativeGas ? normalizeAmount(nativeGas, decimals) : undefined,
        },
      })
    : // Recover the transfer from the originating txid
      await TokenTransfer.from(wh, {
        chain: source.chain.chain,
        txid: recoverTxid,
      });

  console.log("xfer: ", xfer);
  // Log out the results
  if (xfer.getTransferState() < TransferState.DestinationInitiated) {
    console.log(await xfer.completeTransfer(destination.signer));
  }
})();

async function tokenTransfer<N extends Network>(
  wh: Wormhole<N>,
  route: {
    token: TokenId | "native";
    amount: bigint;
    source: TransferStuff<N, Platform, Chain>;
    destination: TransferStuff<N, Platform, Chain>;
    delivery?: {
      automatic: boolean;
      nativeGas?: bigint;
    };
    payload?: Uint8Array;
  },
): Promise<TokenTransfer<N>> {
  // Create a TokenTransfer object to track the state of
  // the transfer over time
  const xfer = await wh.tokenTransfer(
    route.token,
    route.amount,
    route.source.address,
    route.destination.address,
    route.delivery?.automatic ?? false,
    route.payload,
    route.delivery?.nativeGas,
  );

  if (xfer.transfer.automatic) {
    const quote = await TokenTransfer.quoteTransfer(
      route.source.chain,
      route.destination.chain,
      xfer.transfer,
    );
    console.log(quote);

    if (quote.destinationToken.amount < 0)
      throw "The amount requested is too low to cover the fee and any native gas requested.";
  }

  // 1) Submit the transactions to the source chain, passing a signer to sign any txns
  console.log("Starting transfer");
  const srcTxids = await xfer.initiateTransfer(route.source.signer);
  console.log(`Started transfer: `, srcTxids);

  // If automatic, we're done
  if (route.delivery?.automatic) return xfer;

  // 2) wait for the VAA to be signed and ready (not required for auto transfer)
  console.log("Getting Attestation");
  const attestIds = await xfer.fetchAttestation(60_000);
  console.log(`Got Attestation: `, attestIds);

  // 3) redeem the VAA on the dest chain
  console.log("Completing Transfer");
  const destTxids = await xfer.completeTransfer(route.destination.signer);
  console.log(`Completed Transfer: `, destTxids);

  return xfer;
}
