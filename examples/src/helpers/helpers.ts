import {
  ChainAddress,
  ChainContext,
  DEFAULT_TASK_TIMEOUT,
  Network,
  Platform,
  PlatformToChains,
  Signer,
  TokenTransfer,
  TransferState,
  TxHash,
  Wormhole,
  api,
  tasks,
} from "@wormhole-foundation/connect-sdk";

// Importing from src so we dont have to rebuild to see debug stuff in signer
import { getAlgorandSigner } from "@wormhole-foundation/connect-sdk-algorand/src/testing";
import { getCosmwasmSigner } from "@wormhole-foundation/connect-sdk-cosmwasm/src/testing";
import { getEvmSigner } from "@wormhole-foundation/connect-sdk-evm/src/testing";
import { getSolanaSigner } from "@wormhole-foundation/connect-sdk-solana/src/testing";

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
    case "Algorand":
      signer = await getAlgorandSigner(await chain.getRpc(), getEnv("ALGORAND_MNEMONIC"));
      break;
    default:
      throw new Error("Unrecognized platform: " + platform);
  }

  return {
    chain,
    signer: signer as Signer<N, C>,
    address: Wormhole.chainAddress(chain.chain, signer.address()),
  };
}

export async function waitLog<N extends Network = Network>(
  wh: Wormhole<N>,
  xfer: TokenTransfer<N>,
  tag: string = "WaitLog",
  timeout: number = DEFAULT_TASK_TIMEOUT,
) {
  const tracker = TokenTransfer.track(wh, TokenTransfer.getReceipt(xfer), timeout);
  let receipt;
  for await (receipt of tracker) {
    console.log(`${tag}: Current trasfer state: `, TransferState[receipt.state]);
  }
  return receipt;
}

// Note: This API may change but it is currently the best place to pull
// the relay status from
export async function waitForRelay(txid: TxHash): Promise<api.RelayData | null> {
  const relayerApi = "https://relayer.dev.stable.io";
  const task = () => api.getRelayStatus(relayerApi, txid);
  return tasks.retry<api.RelayData>(task, 5000, 60 * 1000, "Wormhole:GetRelayStatus");
}
