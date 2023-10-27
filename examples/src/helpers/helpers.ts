import {
  ChainAddress,
  ChainContext,
  ChainName,
  PlatformName,
  PlatformToChains,
  Signer,
  TransferState,
  WormholeTransfer,
  nativeChainAddress,
  rpcAddress,
} from "@wormhole-foundation/connect-sdk";

import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Keypair } from "@solana/web3.js";
import {
  chainToAddressPrefix,
  cosmwasmNetworkChainToChainId,
  CosmwasmSigner, CosmwasmEvmSigner,
  cosmwasmNetworkChainToRestUrls,
} from "@wormhole-foundation/connect-sdk-cosmwasm";
import bs58 from "bs58";
import { ethers } from "ethers";

import { ChainRestAuthApi } from "@injectivelabs/sdk-ts";

import { EvmSigner } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaSigner } from "@wormhole-foundation/connect-sdk-solana";
// read in from `.env`
require("dotenv").config();
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
      signer = getSolSigner(chain.chain, process.env.SOL_PRIVATE_KEY!);
      break;
    case "Cosmwasm":
      signer = await getCosmosSigner(chain, process.env.COSMOS_MNEMONIC!);
      break;
    default:
      signer = await getEvmSigner(
        chain.chain,
        (await chain.getRpc()) as ethers.Provider,
        process.env.ETH_PRIVATE_KEY!,
      );
  }

  return { chain, signer, address: nativeChainAddress(signer) };
}

export async function waitLog(xfer: WormholeTransfer): Promise<void> {
  console.log("Checking for complete status");
  while ((await xfer.getTransferState()) < TransferState.Completed) {
    console.log("Not yet...");
    await new Promise((f) => setTimeout(f, 5000));
  }
}

export async function getEvmSigner(
  chain: ChainName,
  provider: ethers.Provider,
  privateKey: string,
): Promise<Signer> {
  const wallet = new ethers.Wallet(privateKey);
  const txCount = await provider.getTransactionCount(wallet.address);
  return new EvmSigner(chain, wallet, txCount, provider);
}

export function getSolSigner(chain: ChainName, privateKey: string): Signer {
  return new SolanaSigner(chain, Keypair.fromSecretKey(bs58.decode(privateKey)));
}

export async function getCosmosSigner(
  chain: ChainContext<PlatformName>,
  mnemonic: string,
): Promise<Signer> {
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

    console.log(restRpc, chainId);

    return new CosmwasmEvmSigner(chain.chain, chainId, mnemonic, restRpc);
  }

  let options = getCosmosOptions(chain.chain);

  // Otherwise use the default signer
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: chainToAddressPrefix(chain.chain as PlatformToChains<"Cosmwasm">),
  });

  const acct = (await signer.getAccounts())[0];
  const signingClient = await SigningCosmWasmClient.connectWithSigner(
    rpcAddress(chain.platform.network, chain.chain)!,
    signer,
    options,
  );

  return new CosmwasmSigner(chain.chain, signingClient, acct);
}

function getCosmosOptions(chain: ChainName): object | undefined {
  // TODO: I'm not sure if this is needed
  // if (chain === "Sei") {
  //   const {
  //     cosmosAminoConverters,
  //     cosmwasmAminoConverters,
  //     cosmwasmProtoRegistry,
  //     ibcAminoConverters,
  //     seiprotocolProtoRegistry,
  //     seiprotocolAminoConverters,
  //   } = require("@sei-js/proto");
  //   const registry = new Registry([
  //     ...defaultRegistryTypes,
  //     ...cosmwasmProtoRegistry,
  //     ...seiprotocolProtoRegistry,
  //   ]);

  //   const aminoTypes = new AminoTypes({
  //     ...cosmosAminoConverters,
  //     ...cosmwasmAminoConverters,
  //     ...ibcAminoConverters,
  //     ...seiprotocolAminoConverters,
  //   });
  //   return { registry, aminoTypes };
  // }

  return undefined;
}
