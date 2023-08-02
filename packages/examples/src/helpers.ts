import bs58 from "bs58";
import { ethers } from "ethers";
import { Keypair } from "@solana/web3.js";

// read in from `.env`
require("dotenv").config();

// TODO: err msg instructing dev to `cp .env.template .env` and set values

export function getSolSigner(): Keypair {
  const pk = process.env.SOL_PRIVATE_KEY!;
  return Keypair.fromSecretKey(bs58.decode(pk));
}

export function getEthSigner(
  provider: ethers.providers.Provider
): ethers.Wallet {
  const pk = process.env.ETH_PRIVATE_KEY!;
  return new ethers.Wallet(pk, provider);
}
