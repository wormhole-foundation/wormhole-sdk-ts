import {
  ChainAddress,
  ChainContext,
  Platform,
  PlatformToChains,
  Signer,
  TransferState,
  TxHash,
  WormholeTransfer,
  api,
  nativeChainAddress,
  tasks,
} from "@wormhole-foundation/connect-sdk";
import { getCosmwasmSigner } from "@wormhole-foundation/connect-sdk-cosmwasm/src/testing";

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
  N extends Network,
  P extends Platform,
  C extends PlatformToChains<P> = PlatformToChains<P>,
> {
  chain: ChainContext<N, P, C>;
  signer: Signer<N, C>;
  address: ChainAddress<C>;
}

export async function getStuff<
  N extends Network,
  P extends Platform,
  C extends PlatformToChains<P>,
>(chain: ChainContext<N, P, C>): Promise<TransferStuff<N, P, C>> {
  let signer: Signer;
  const platform = chain.platform.utils()._platform;
  switch (platform) {
    case "Solana":
      signer = await getSolanaSigner(await chain.getRpc(), getEnv("SOL_PRIVATE_KEY"));
      break;
    case "Cosmwasm":
      signer = await getCosmwasmSigner(await chain.getRpc(), getEnv("COSMOS_MNEMONIC"));
      break;
    case "Evm":
      signer = await getEvmSigner(await chain.getRpc(), getEnv("ETH_PRIVATE_KEY"));
      break;
    default:
      throw new Error("Unrecognized platform: " + platform);
  }

  return {
    chain,
    signer: signer as Signer<N, C>,
    address: nativeChainAddress(chain.chain, signer.address()),
  };
}

export async function waitLog(xfer: WormholeTransfer): Promise<WormholeTransfer> {
  console.log("Checking for complete status");
  while (xfer.getTransferState() < TransferState.DestinationInitiated) {
    console.log("Not yet...");
    await new Promise((f) => setTimeout(f, 5000));
  }
  return xfer;
}

// Note: This API may change but it is currently the best place to pull
// the relay status from
export async function waitForRelay(txid: TxHash): Promise<api.RelayData | null> {
  const relayerApi = "https://relayer.dev.stable.io";
  const task = () => api.getRelayStatus(relayerApi, txid);
  return tasks.retry<api.RelayData>(task, 5000, 60 * 1000, "Wormhole:GetRelayStatus");
}
