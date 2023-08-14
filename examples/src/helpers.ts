import bs58 from "bs58";
import { ethers } from "ethers";
import { Keypair } from "@solana/web3.js";
import { Signer } from "@wormhole-foundation/connect-sdk";
import { ChainName } from "@wormhole-foundation/sdk-base";

// read in from `.env`
require("dotenv").config();

// TODO: err msg instructing dev to `cp .env.template .env` and set values

export function getSolSigner(): Keypair {
  const pk = process.env.SOL_PRIVATE_KEY!;
  return Keypair.fromSecretKey(bs58.decode(pk));
}

class EthSigner implements Signer {
  constructor(private _chain: ChainName, private _wallet: ethers.Wallet) {}
  chain(): ChainName {
    return this._chain;
  }
  address(): string {
    return this._wallet.address;
  }
  async sign(tx: any): Promise<any> {
    return await this._wallet.signTransaction(tx);
  }
}
export function getEvmSigner(chain: ChainName): EthSigner {
  const pk = process.env.ETH_PRIVATE_KEY!;
  return new EthSigner(chain, new ethers.Wallet(pk));
}
