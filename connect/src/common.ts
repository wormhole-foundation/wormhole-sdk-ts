import {
  ChainContext,
  Signer,
  TransactionId,
  TxHash,
  UnsignedTransaction,
  isSignAndSendSigner,
  isSigner,
} from "@wormhole-foundation/sdk-definitions";
import { PlatformName } from "@wormhole-foundation/sdk-base";

export async function signSendWait(
  chain: ChainContext<PlatformName>,
  xfer: AsyncGenerator<UnsignedTransaction>,
  signer: Signer,
): Promise<TransactionId[]> {
  const txHashes: TxHash[] = [];

  if (!isSigner(signer)) throw new Error("Invalid signer, not SignAndSendSigner or SignOnlySigner")

  const signSend = async (txns: UnsignedTransaction[]): Promise<TxHash[]> => {
    if (isSignAndSendSigner(signer)) {
      return signer.signAndSend(txns);
    }
    return chain.sendWait(await signer.sign(txns));
  }

  // buffer unsigned transactions as long as they are
  // marked as parallelizable
  let txbuff: UnsignedTransaction[] = [];
  for await (const tx of xfer) {
    // if parallelizable, buffer it
    if (tx.parallelizable) {
      txbuff.push(tx);
    } else {
      if (txbuff.length > 0) {
        txHashes.push(...await signSend(txbuff));
        txbuff = [];
      }
      txHashes.push(...await signSend([tx]));
    }
  }

  if (txbuff.length > 0) {
    txHashes.push(...await signSend(txbuff));
  }

  return txHashes.map((txid) => ({ chain: chain.chain, txid }));
}
