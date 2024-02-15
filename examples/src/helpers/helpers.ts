import {
  ChainAddress,
  ChainContext,
  DEFAULT_TASK_TIMEOUT,
  Network,
  Signer,
  TokenTransfer,
  TransferState,
  TxHash,
  Wormhole,
  Chain,
  api,
  tasks,
} from "@wormhole-foundation/connect-sdk";

// Importing from src so we dont have to rebuild to see debug stuff in signer
import { getAlgorandSigner } from "@wormhole-foundation/connect-sdk-algorand/src";
import { getCosmwasmSigner } from "@wormhole-foundation/connect-sdk-cosmwasm/src";
import { getEvmSignerForKey } from "@wormhole-foundation/connect-sdk-evm/src";
import { getSolanaSignAndSendSigner } from "@wormhole-foundation/connect-sdk-solana/src";
import { getSuiSigner } from "@wormhole-foundation/connect-sdk-sui";

// Use .env.example as a template for your .env file and populate it with secrets
// for funded accounts on the relevant chain+network combos to run the example

// Read in from `.env`
require("dotenv").config();

function getEnv(key: string): string {
  // If we're in the browser, return empty string
  if (typeof process === undefined) return "";

  // Otherwise, return the env var or error
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var ${key}, did you forget to set valies in '.env'?`);

  return val;
}

export interface TransferStuff<N extends Network, C extends Chain> {
  chain: ChainContext<N, C>;
  signer: Signer<N, C>;
  address: ChainAddress<C>;
}

export async function getStuff<N extends Network, C extends Chain>(
  chain: ChainContext<N, C>,
): Promise<TransferStuff<N, C>> {
  let signer: Signer;
  const platform = chain.platform.utils()._platform;
  switch (platform) {
    case "Solana":
      signer = await getSolanaSignAndSendSigner(await chain.getRpc(), getEnv("SOL_PRIVATE_KEY"), {
        computeLimit: 500_000n,
        priorityFeeAmount: 100_000n,
      });
      break;
    case "Cosmwasm":
      signer = await getCosmwasmSigner(await chain.getRpc(), getEnv("COSMOS_MNEMONIC"));
      break;
    case "Evm":
      signer = await getEvmSignerForKey(await chain.getRpc(), getEnv("ETH_PRIVATE_KEY"));
      break;
    case "Algorand":
      signer = await getAlgorandSigner(await chain.getRpc(), getEnv("ALGORAND_MNEMONIC"));
      break;
    case "Sui":
      signer = await getSuiSigner(await chain.getRpc(), getEnv("SUI_PRIVATE_KEY"));
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
