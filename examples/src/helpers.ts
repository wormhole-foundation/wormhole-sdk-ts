import { ChainName } from "@wormhole-foundation/sdk-base";
import {
  Signer,
  ChainContext,
  ChainAddress,
  SignedTxn,
  UnsignedTransaction,
} from "@wormhole-foundation/sdk-definitions";

import bs58 from "bs58";
import { ethers } from "ethers";
import { Keypair } from "@solana/web3.js";

// read in from `.env`
require("dotenv").config();

// TODO: err msg instructing dev to `cp .env.template .env` and set values

export type TransferStuff = {
  chain: ChainContext;
  signer: Signer;
  address: ChainAddress;
};

export async function getStuff(chain: ChainContext): Promise<TransferStuff> {
  const signer = await getEvmSigner(
    chain.chain,
    chain.getRpc() as ethers.Provider
  );

  const address: ChainAddress = {
    chain: signer.chain(),
    address: chain.platform.parseAddress(signer.address()),
  };

  return { chain, signer, address };
}

export function getSolSigner(): Keypair {
  const pk = process.env.SOL_PRIVATE_KEY!;
  return Keypair.fromSecretKey(bs58.decode(pk));
}

class EthSigner implements Signer {
  constructor(
    private _chain: ChainName,
    private _wallet: ethers.Wallet,
    private nonce: number,
    private provider: ethers.Provider
  ) {}
  chain(): ChainName {
    return this._chain;
  }
  address(): string {
    return this._wallet.address;
  }
  async sign(tx: UnsignedTransaction[]): Promise<SignedTxn[]> {
    const signed = [];

    let { gasPrice } = await this.provider.getFeeData();
    if (!gasPrice) gasPrice = 50_000_000_000n;

    for (const txn of tx) {
      const est = await this.provider.estimateGas(txn.transaction);
      const limit = gasPrice * est * 2n;

      const t: ethers.TransactionRequest = {
        ...txn.transaction,
        ...{
          gasLimit: limit,
          maxFeePerGas: gasPrice,
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

  return new EthSigner(chain, wallet, txCount, provider);
}
