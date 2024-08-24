import type { SuiClient } from "@mysten/sui.js/client";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import type {
  Network,
  SignAndSendSigner,
  Signer,
  TxHash,
  UnsignedTransaction,
} from "@wormhole-foundation/sdk-connect";
import { SuiPlatform } from "./platform.js";
import type { SuiChains } from "./types.js";
import type { SuiUnsignedTransaction } from "./unsignedTransaction.js";

export async function getSuiSigner(rpc: SuiClient, privateKey: string): Promise<Signer> {
  const [, chain] = await SuiPlatform.chainFromRpc(rpc);
  return new SuiSigner(chain, rpc, Ed25519Keypair.deriveKeypair(privateKey, "m/44'/784'/0'/0'/0'"));
}

// SuiSigner implements SignOnlySender
export class SuiSigner<N extends Network, C extends SuiChains> implements SignAndSendSigner<N, C> {
  constructor(
    private _chain: C,
    private _client: SuiClient,
    private _signer: Ed25519Keypair,
    private _debug?: boolean,
  ) {}

  chain(): C {
    return this._chain;
  }

  address(): string {
    return this._signer.toSuiAddress();
  }

  async signAndSend(txns: UnsignedTransaction[]): Promise<TxHash[]> {
    const txids: TxHash[] = [];
    for (const tx of txns) {
      const { description, transaction } = tx as SuiUnsignedTransaction<N, C>;
      if (this._debug) console.log(`Signing ${description} for ${this.address()}`);

      try {
        const result = await this._client.signAndExecuteTransactionBlock({
          transactionBlock: transaction,
          signer: this._signer,
        });
        txids.push(result.digest);
      } catch (e) {
        // If the transaction fails on Sui, its often in a dryrun, but im currently
        // too lazy to write a typeguard to make this safe
        //const stuff = (e as Error).cause as DryRunTransactionBlockResponse;
        //const { input, effects } = stuff;

        //if (input.transaction.kind === "ProgrammableTransaction") {
        //  console.error("ProgrammableTransaction");
        //  console.error("Txs\n", input.transaction.transactions);
        //  console.error("Inputs\n", input.transaction.inputs);
        //}
        //console.error("Effects\n", effects);
        throw e;
      }
    }
    return txids;
  }
}
