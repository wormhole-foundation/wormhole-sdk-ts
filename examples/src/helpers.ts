import { ChainName, platformToChains } from "@wormhole-foundation/sdk-base";
import {
  Signer,
  ChainContext,
  ChainAddress,
  SignedTxn,
  UnsignedTransaction,
} from "@wormhole-foundation/sdk-definitions";

import bs58 from "bs58";
import { ethers } from "ethers";
import { Transaction, Keypair } from "@solana/web3.js";

// read in from `.env`
require("dotenv").config();

// TODO: err msg instructing dev to `cp .env.template .env` and set values

export type TransferStuff = {
  chain: ChainContext;
  signer: Signer;
  address: ChainAddress;
};

export async function getStuff(chain: ChainContext): Promise<TransferStuff> {
  let signer: Signer;
  switch (chain.platform.platform) {
    case "Solana":
      signer = await getSolSigner(chain.chain);
      break;
    default:
      signer = await getEvmSigner(
        chain.chain,
        chain.getRpc() as ethers.Provider
      );
  }

  const address: ChainAddress = {
    chain: signer.chain(),
    address: chain.platform.parseAddress(signer.address()),
  };

  return { chain, signer, address };
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

export function getSolSigner(chain: ChainName): SolSigner {
  const pk = process.env.SOL_PRIVATE_KEY!;
  return new SolSigner(chain, Keypair.fromSecretKey(bs58.decode(pk)));
}

class SolSigner implements Signer {
  constructor(private _chain: ChainName, private _keypair: Keypair) {}

  chain(): ChainName {
    return this._chain;
  }

  address(): string {
    return this._keypair.publicKey.toBase58();
  }

  async sign(tx: UnsignedTransaction[]): Promise<any[]> {
    const signed = [];
    for (const txn of tx) {
      const { description, transaction } = txn;

      const t = transaction as Transaction;

      console.log(t.instructions);
      for (const ix of t.instructions) {
        console.log(ix.data);
        console.log(ix.keys);
        console.log(ix.programId.toBase58());
      }

      console.log(`Signing: ${description} for ${this.address()}`);

      transaction.partialSign(this._keypair);
      signed.push(transaction.serialize());
    }
    return signed;
  }
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
    const { gasPrice, maxFeePerGas } = await this.provider.getFeeData();
    // TODO: get better gas prices
    for (const txn of tx) {
      const { transaction, description } = txn;
      console.log(`Signing: ${description} for ${this.address()}`);

      const t: ethers.TransactionRequest = {
        ...transaction,
        ...{
          gasLimit: 10_000_000n,
          gasPrice: gasPrice,
          maxFeePerGas: maxFeePerGas,
          nonce: this.nonce,
        },
      };
      signed.push(await this._wallet.signTransaction(t));

      this.nonce += 1;
    }
    return signed;
  }
}
