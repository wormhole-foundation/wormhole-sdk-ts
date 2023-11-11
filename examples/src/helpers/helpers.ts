import {
  Chain,
  ChainAddress,
  ChainContext,
  Platform,
  PlatformToChains,
  Signer,
  TransferState,
  WormholeTransfer,
  nativeChainAddress,
} from "@wormhole-foundation/connect-sdk";

//import { getCosmwasmSigner } from "@wormhole-foundation/connect-sdk-cosmwasm/src/testing";
import { getEvmSigner } from "@wormhole-foundation/connect-sdk-evm/src/testing";
import { getSolanaSigner } from "@wormhole-foundation/connect-sdk-solana/src/testing";
import { Network } from "@wormhole-foundation/sdk-base/src";

// read in from `.env`
require("dotenv").config();

function getEnv(key: string): string {
  // If we're in the browser, return empty string
  if (typeof process === undefined) return "";

  // Otherwise, return the env var or error
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var ${key}, did you forget to set valies in '.env'?`);

  return val;
}

export interface TransferStuff<
  N extends Network = "Testnet",
  P extends Platform = "Evm",
  C extends PlatformToChains<P> = PlatformToChains<P>,
> {
  chain: ChainContext<N, P, C>;
  signer: Signer;
  address: ChainAddress<C>;
}

export async function getStuff<N extends Network, P extends Platform, C extends Chain>(
  chain: ChainContext<N, P, C>,
): Promise<TransferStuff<N, P, C>> {
  let signer: Signer;

  switch (chain.platformUtils._platform) {
    case "Solana":
      signer = await getSolanaSigner(await chain.getRpc(), getEnv("SOL_PRIVATE_KEY"));
      break;
    //case "Cosmwasm":
    //  signer = await getCosmwasmSigner(await chain.getRpc(), getEnv("COSMOS_MNEMONIC"));
    //  break;
    case "Evm":
      signer = await getEvmSigner(await chain.getRpc(), getEnv("ETH_PRIVATE_KEY"));
      break;
    default:
      throw new Error("Unrecognized platform: " + chain.platformUtils._platform);
  }

  return { chain, signer, address: nativeChainAddress(signer.chain() as C, signer.address()) };
}

export async function waitLog(xfer: WormholeTransfer): Promise<void> {
  console.log("Checking for complete status");
  while ((await xfer.getTransferState()) < TransferState.Completed) {
    console.log("Not yet...");
    await new Promise((f) => setTimeout(f, 5000));
  }
}
