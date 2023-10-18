import {
  ChainAddress,
  ChainConfig,
  ChainContext,
  ChainName,
  PlatformName,
  PlatformToChains,
  Signer,
  WormholeConfig,
  nativeChainAddress,
  rpcAddress,
} from "@wormhole-foundation/connect-sdk";

import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Keypair } from "@solana/web3.js";
import {
  chainToAddressPrefix,
  cosmwasmNetworkChainToChainId,
  cosmwasmNetworkChainToRestUrls,
} from "@wormhole-foundation/connect-sdk-cosmwasm";
import { ethers } from "ethers";

import { ChainRestAuthApi } from "@injectivelabs/sdk-ts";
import { CosmosEvmSigner, CosmosSigner, EvmSigner, SolSigner } from "./signers";
import { ETH_PRIVATE_KEY, SOLANA_PRIVATE_KEY, TERRA2_PRIVATE_KEY, TERRA_PRIVATE_KEY } from "./consts";

export interface TransferStuff {
  chain: ChainContext<PlatformName>;
  signer: Signer;
  address: ChainAddress;
}

// TODO: err msg instructing dev to `cp .env.template .env` and set values
export async function getStuff(
  chain: ChainContext<PlatformName>,
): Promise<TransferStuff> {
  let signer: Signer;
  switch (chain.platform.platform) {
    case "Solana":
      signer = getSolSigner(chain);
      break;
    case "Cosmwasm":
      signer = await getCosmosSigner(chain);
      break;
    default:
      signer = await getEvmSigner(chain);
  }

  return { chain, signer, address: nativeChainAddress(signer) };
}

export async function getEvmSigner(
  chain: ChainContext<PlatformName>,
  pk?: string
): Promise<Signer> {
  const provider = (await chain.getRpc()) as ethers.Provider
  const wallet = new ethers.Wallet(pk ?? ETH_PRIVATE_KEY);
  const txCount = await provider.getTransactionCount(wallet.address);
  return new EvmSigner(chain.chain, wallet, txCount, provider);
}

export function getSolSigner(chain: ChainContext<PlatformName>): Signer {
  return new SolSigner(chain.chain, Keypair.fromSecretKey(SOLANA_PRIVATE_KEY));
}

export async function getCosmosSigner(
  chain: ChainContext<PlatformName>,
  mnemonic?: string,
): Promise<Signer> {
  mnemonic = mnemonic ?? TERRA_PRIVATE_KEY;
  // Use the EVM signer for Evmos and Injective
  if (["Evmos", "Injective"].includes(chain.chain)) {
    const restRpc = new ChainRestAuthApi(
      // @ts-ignore
      cosmwasmNetworkChainToRestUrls(chain.platform.network, chain.chain),
    );
    const chainId = cosmwasmNetworkChainToChainId(
      chain.platform.network,
      // @ts-ignore
      chain.chain,
    );
    return new CosmosEvmSigner(chain.chain, chainId, mnemonic, restRpc);
  }

  // Otherwise use the default signer
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: chainToAddressPrefix(chain.chain as PlatformToChains<"Cosmwasm">),
  });

  const acct = (await signer.getAccounts())[0];
  const signingClient = await SigningCosmWasmClient.connectWithSigner(
    rpcAddress(chain.platform.network, chain.chain)!,
    signer
  );

  return new CosmosSigner(chain.chain, signingClient, acct);
}



// const conf = overrideChainSetting(CONFIG[network], {
//     "Ethereum": { "rpc": "http://localhost:8545" },
//     "Bsc": { "rpc": "http://localhost:8546" },
//     "Solana": { "rpc": "http://localhost:8899" }
// })

export type ConfigOverride = {
  [key: string]: Partial<ChainConfig>
}
export function overrideChainSetting(conf: WormholeConfig, overrides: ConfigOverride): WormholeConfig {
  for (const [cn, oride] of Object.entries(overrides)) {
    // @ts-ignore
    conf.chains[cn] = { ...conf.chains[cn], ...oride }
  }
  return conf
}
