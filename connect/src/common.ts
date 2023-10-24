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
    txbuff.push(tx);
    if (tx.parallelizable) continue;
    // If !parallelizable, sign/send the current buffer
    txHashes.push(...await signSend(txbuff));
    // reset buffer
    txbuff = [];
  }

  if (txbuff.length > 0) {
    txHashes.push(...await signSend(txbuff));
  }

  return txHashes.map((txid) => ({ chain: chain.chain, txid }));
}
