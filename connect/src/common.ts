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

  if (!isSigner(signer)) throw new Error("Invalid signer, not SignAndSendSigner or SignOnlySigner");

  const signSend = async (txns: UnsignedTransaction[]): Promise<TxHash[]> =>
    isSignAndSendSigner(signer)
      ? signer.signAndSend(txns)
      : chain.sendWait(await signer.sign(txns));

  let txbuff: UnsignedTransaction[] = [];
  for await (const tx of xfer) {
    // buffer transactions as long as they are
    // marked as parallelizable
    if (tx.parallelizable) {
      txbuff.push(tx);
    } else {
      // if we find one is not parallelizable
      // flush the buffer then sign and send the
      // current tx
      if (txbuff.length > 0) {
        txHashes.push(...(await signSend(txbuff)));
        txbuff = [];
      }
      // Note: it may be possible to group this tx with
      // those in the buffer if there are any but
      // the parallelizable flag alone is not enough to signal
      // if this is safe
      txHashes.push(...(await signSend([tx])));
    }
  }
  console.log("txbuff: ", txbuff);
  console.log("txHashes: ", txHashes);
  if (txbuff.length > 0) {
    txHashes.push(...(await signSend(txbuff)));
  }

  return txHashes.map((txid) => ({ chain: chain.chain, txid }));
}
