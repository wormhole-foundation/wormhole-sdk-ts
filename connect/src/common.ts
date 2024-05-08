import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import type {
  ChainContext,
  SignAndSendSigner,
  Signer,
  TransactionId,
  TxHash,
  UnsignedTransaction,
} from "@wormhole-foundation/sdk-definitions";
import { isSignAndSendSigner, isSigner } from "@wormhole-foundation/sdk-definitions";

type SignSend<N extends Network, C extends Chain> = (
  txns: UnsignedTransaction<N, C>[],
) => Promise<TxHash[]>;

export async function signSendWait<N extends Network, C extends Chain>(
  chain: ChainContext<N, C>,
  xfer: AsyncGenerator<UnsignedTransaction<N, C>>,
  signer: Signer<N, C>,
): Promise<TransactionId[]> {
  if (!isSigner(signer)) throw new Error("Invalid signer, not SignAndSendSigner or SignOnlySigner");

  const signSend = async (txns: UnsignedTransaction<N, C>[]): Promise<TxHash[]> =>
    isSignAndSendSigner(signer)
      ? signer.signAndSend(txns)
      : chain.sendWait(await signer.sign(txns));

  const txHashes = await ssw(xfer, signSend);
  return txHashes.map((txid) => ({ chain: chain.chain, txid }));
}

export async function signAndSendWait<N extends Network, C extends Chain>(
  xfer: AsyncGenerator<UnsignedTransaction<N, C>>,
  signer: SignAndSendSigner<N, C>,
): Promise<TransactionId[]> {
  if (!isSignAndSendSigner(signer))
    throw new Error("Invalid signer, only SignAndSendSigner may call this method");
  const signSend: SignSend<N, C> = (txs) => signer.signAndSend(txs);
  const txHashes = await ssw(xfer, signSend);
  return txHashes.map((txid) => ({ chain: signer.chain(), txid }));
}

async function ssw<N extends Network, C extends Chain>(
  xfer: AsyncGenerator<UnsignedTransaction<N, C>>,
  signSend: SignSend<N, C>,
): Promise<TxHash[]> {
  const txids: TxHash[] = [];
  let txbuff: UnsignedTransaction<N, C>[] = [];
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
        txids.push(...(await signSend(txbuff)));
        txbuff = [];
      }
      // Note: it may be possible to group this tx with
      // those in the buffer if there are any but
      // the parallelizable flag alone is not enough to signal
      // if this is safe
      txids.push(...(await signSend([tx])));
    }
  }

  if (txbuff.length > 0) {
    txids.push(...(await signSend(txbuff)));
  }

  return txids;
}
