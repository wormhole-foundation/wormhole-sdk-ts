import {
  ChainContext,
  Signer,
  TransactionId,
  TxHash,
  UnsignedTransaction,
} from "@wormhole-foundation/sdk-definitions";
import { PlatformName } from "@wormhole-foundation/sdk-base";

export async function signSendWait(
  chain: ChainContext<PlatformName>,
  xfer: AsyncGenerator<UnsignedTransaction>,
  signer: Signer,
): Promise<TransactionId[]> {
  // buffer unsigned transactions as long as they are
  // marked as parallelizable
  let txbuff: UnsignedTransaction[] = [];

  const txHashes: TxHash[] = [];
  for await (const tx of xfer) {
    txbuff.push(tx);
    if (tx.parallelizable) continue

    // If !parallelizable, sign/send the current buffer
    const signed = await signer.sign(txbuff);
    const txids = await chain.sendWait(signed);
    txHashes.push(...txids);

    // reset buffer
    txbuff = [];
  }

  if (txbuff.length > 0) {
    const signed = await signer.sign(txbuff);
    const txids = await chain.sendWait(signed);
    txHashes.push(...txids);
  }

  return txHashes.map((txid) => ({ chain: chain.chain, txid }));
}
