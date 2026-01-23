import type {
  Network,
  RpcConnection,
  SignAndSendSigner,
  Signer,
  TxHash,
  UnsignedTransaction,
} from "@wormhole-foundation/sdk-connect";
import { encoding } from "@wormhole-foundation/sdk-connect";
import { AptosPlatform } from "./platform.js";
import type { AptosChains } from "./types.js";
import {
  Account,
  AnyRawTransaction,
  Aptos,
  CommittedTransactionResponse,
  Ed25519PrivateKey,
  InputGenerateTransactionPayloadData,
} from "@aptos-labs/ts-sdk";

// returns a SignOnlySigner for the Aptos platform
export async function getAptosSigner(
  rpc: RpcConnection<"Aptos">,
  privateKey: string,
): Promise<Signer> {
  const [_, chain] = await AptosPlatform.chainFromRpc(rpc);
  const account = Account.fromPrivateKey({
    // TODO: support secp256k1
    privateKey: new Ed25519PrivateKey(encoding.hex.decode(privateKey)),
  });
  return new AptosSigner(chain, account, rpc);
}

export class AptosSigner<N extends Network, C extends AptosChains>
  implements SignAndSendSigner<N, C>
{
  constructor(
    private _chain: C,
    private _account: Account,
    private _rpc: Aptos,
    private _debug?: boolean,
  ) {}

  chain() {
    return this._chain;
  }

  address(): string {
    return this._account.accountAddress.toString();
  }

  async signAndSend(tx: UnsignedTransaction[]): Promise<TxHash[]> {
    const txhashes = [];
    for (const txn of tx) {
      const { description, transaction } = txn as {
        description: string;
        transaction: InputGenerateTransactionPayloadData;
      };
      if (this._debug) console.log(`Signing: ${description} for ${this.address()}`);

      const tx = await this._rpc.transaction.build.simple({
        sender: this._account.accountAddress,
        data: transaction,
      });

      const { hash } = await this._simSignSend(tx);
      txhashes.push(hash);
    }
    return txhashes;
  }

  private async _simSignSend(rawTx: AnyRawTransaction): Promise<CommittedTransactionResponse> {
    // simulate transaction
    await this._rpc.transaction.simulate
      .simple({
        signerPublicKey: this._account.publicKey,
        transaction: rawTx,
      })
      .then((sims) =>
        sims.forEach((tx) => {
          if (!tx.success) {
            throw new Error(`Transaction failed: ${tx.vm_status}\n${JSON.stringify(tx, null, 2)}`);
          }
        }),
      );

    return this._rpc
      .signAndSubmitTransaction({ signer: this._account, transaction: rawTx })
      .then((pendingTx) => this._rpc.waitForTransaction({ transactionHash: pendingTx.hash }));
  }
}
