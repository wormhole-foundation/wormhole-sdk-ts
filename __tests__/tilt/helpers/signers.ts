import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { AccountData } from "@cosmjs/proto-signing";
import {
  ChainRestAuthApi,
  DEFAULT_STD_FEE,
  MsgExecuteContract,
  Msgs,
  PrivateKey,
  TxClient,
  createTransaction,
} from "@injectivelabs/sdk-ts";
import { Keypair, Transaction } from "@solana/web3.js";
import {
  ChainName,
  PlatformToChains,
  SignedTx,
  Signer,
  UnsignedTransaction,
} from "@wormhole-foundation/connect-sdk";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { ethers } from "ethers";

import {
  CosmwasmUnsignedTransaction,
  chainToAddressPrefix,
} from "@wormhole-foundation/connect-sdk-cosmwasm";

export class EvmSigner implements Signer {
  constructor(
    private _chain: ChainName,
    private _wallet: ethers.Wallet,
    private nonce: number,
    private provider: ethers.Provider,
  ) { }
  chain(): ChainName {
    return this._chain;
  }
  address(): string {
    return this._wallet.address;
  }
  async sign(tx: UnsignedTransaction[]): Promise<SignedTx[]> {
    const signed = [];

    let maxFeePerGas = 1_500_000_000n; // 1.5gwei
    let maxPriorityFeePerGas = 100_000_000n; // 0.1gwei

    if (this._chain !== "Celo") {
      const feeData = await this.provider.getFeeData();
      maxFeePerGas = feeData.maxFeePerGas ?? maxFeePerGas;
      maxPriorityFeePerGas =
        feeData.maxPriorityFeePerGas ?? maxPriorityFeePerGas;
    }

    for (const txn of tx) {
      const { transaction, description } = txn;
      console.log(`Signing: ${description} for ${this.address()}`);

      const t: ethers.TransactionRequest = {
        ...transaction,
        ...{
          gasLimit: 500_000n,
          maxFeePerGas,
          maxPriorityFeePerGas,
          nonce: this.nonce,
        },
      };
      signed.push(await this._wallet.signTransaction(t));

      this.nonce += 1;
    }
    return signed;
  }
}

export class SolSigner implements Signer {
  constructor(private _chain: ChainName, private _keypair: Keypair) { }

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

      console.log(`Signing: ${description} for ${this.address()}`);
      transaction.partialSign(this._keypair);
      signed.push(transaction.serialize());

      // Uncomment for debug
      // const st = transaction as Transaction;
      // console.log(st.signatures);
      // console.log(st.feePayer);
      // st.instructions.forEach((ix) => {
      //   console.log("Program", ix.programId.toBase58());
      //   console.log("Data: ", ix.data.toString("hex"));
      //   ix.keys.forEach((k) => {
      //     console.log(k.pubkey.toBase58());
      //   });
      // });
    }
    return signed;
  }
}

export class CosmosSigner implements Signer {
  constructor(
    private _chain: ChainName,
    private _signer: SigningCosmWasmClient,
    private _account: AccountData,
  ) { }

  chain(): ChainName {
    return this._chain;
  }

  address(): string {
    return this._account.address;
  }

  async sign(tx: UnsignedTransaction[]): Promise<SignedTx[]> {
    const signed = [];
    for (const txn of tx) {
      const { description, transaction } = txn as CosmwasmUnsignedTransaction;
      console.log(`Signing: ${description} for ${this.address()}`);

      const txRaw = await this._signer.sign(
        this.address(),
        transaction.msgs,
        transaction.fee,
        transaction.memo,
      );

      const encoded = TxRaw.encode(txRaw).finish();
      signed.push(encoded);
    }

    return signed;
  }
}

export class CosmosEvmSigner implements Signer {
  private key: PrivateKey;
  private prefix: string;
  constructor(
    private _chain: ChainName,
    private _chainId: string,
    private _mnemonic: string,
    private _rpc: ChainRestAuthApi,
  ) {
    this.prefix = chainToAddressPrefix(_chain as PlatformToChains<"Cosmwasm">);
    this.key = PrivateKey.fromMnemonic(_mnemonic);
  }

  chain() {
    return this._chain;
  }

  address() {
    return this.key.toAddress().toBech32(this.prefix);
  }

  async sign(txns: UnsignedTransaction[]): Promise<SignedTx[]> {
    const pubKey = this.key.toPublicKey().toBase64();
    const { sequence, accountNumber } = await this.getSignerData();

    const signed: SignedTx[] = [];
    for (const tx of txns) {
      const { description, transaction } = tx as CosmwasmUnsignedTransaction;
      console.log(`Signing ${description} for ${this.address()}`);

      // need to set contractAddress and msg
      const message: Msgs[] = transaction.msgs.map((m) => {
        const f = {
          ...m.value,
          msg: JSON.parse(Buffer.from(m.value.msg).toString()),
          contractAddress: m.value.contract,
        };
        return new MsgExecuteContract(f);
      });

      const { signBytes, txRaw } = createTransaction({
        message,
        pubKey,
        sequence,
        accountNumber,
        chainId: this._chainId,
        memo: transaction.memo,
        fee: DEFAULT_STD_FEE,
      });
      txRaw.signatures = [await this.key.sign(Buffer.from(signBytes))];
      signed.push(Buffer.from(TxClient.encode(txRaw), "base64"));
    }

    return signed;
  }

  async getSignerData(): Promise<{
    address: string;
    sequence: number;
    accountNumber: number;
  }> {
    const address = this.address();
    const { account } = await this._rpc.fetchAccount(address);
    const accountNumber = parseInt(account.base_account.account_number, 10);
    const sequence = parseInt(account.base_account.sequence, 10);
    return { address, sequence, accountNumber };
  }
}
