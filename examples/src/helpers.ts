import bs58 from "bs58";
import { ethers } from "ethers";
import { Keypair } from "@solana/web3.js";
import { SignedTxn, Signer } from "@wormhole-foundation/connect-sdk";
import { ChainName } from "@wormhole-foundation/sdk-base";
import { UnsignedTransaction } from "@wormhole-foundation/sdk-definitions";

// read in from `.env`
require("dotenv").config();

// TODO: err msg instructing dev to `cp .env.template .env` and set values

export function getSolSigner(): Keypair {
  const pk = process.env.SOL_PRIVATE_KEY!;
  return Keypair.fromSecretKey(bs58.decode(pk));
}

class EthSigner implements Signer {
  constructor(
    private _chain: ChainName,
    private _wallet: ethers.Wallet,
    private nonce: number
  ) {}
  chain(): ChainName {
    return this._chain;
  }
  address(): string {
    return this._wallet.address;
  }
  async sign(tx: UnsignedTransaction[]): Promise<SignedTxn[]> {
    const signed = [];
    for (const txn of tx) {
      const t: ethers.TransactionRequest = {
        ...txn.transaction,
        ...{
          gasLimit: 200_000,
          maxFeePerGas: 40_000_000_000,
          nonce: this.nonce,
        },
      };
      signed.push(await this._wallet.signTransaction(t));

      this.nonce += 1;
    }
    return signed;
  }
}
export async function getEvmSigner(
  chain: ChainName,
  provider: ethers.Provider
): Promise<EthSigner> {
  const pk = process.env.ETH_PRIVATE_KEY!;
  const wallet = new ethers.Wallet(pk);

  const txCount = await provider.getTransactionCount(wallet.address);

  return new EthSigner(chain, wallet, txCount);
}
