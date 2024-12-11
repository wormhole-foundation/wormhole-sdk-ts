import {
  Cluster,
  clusterApiUrl,
  Connection,
  PublicKey,
  PublicKeyInitData,
  SimulatedTransactionResponse,
  TransactionInstruction,
  TransactionMessage,
  TransactionResponse,
  VersionedTransaction,
  VersionedTransactionResponse,
} from '@solana/web3.js';
import {
  deserializeLayout,
  Layout,
  LayoutToType,
  Network,
} from '@wormhole-foundation/sdk-base';

/**
 * Simulates the transaction and returns the result. Throws if it failed.
 * @param connection The connection used to run the simulation.
 * @param payer The payer. No signature is needed, so no fee will be payed.
 * @param instructions The instructions to simulate.
 * @returns
 */
export async function simulateTransaction(
  connection: Connection,
  payer: PublicKeyInitData,
  instructions: TransactionInstruction[],
): Promise<SimulatedTransactionResponse> {
  const {
    value: { blockhash },
  } = await connection.getLatestBlockhashAndContext();
  const txMessage = new TransactionMessage({
    payerKey: new PublicKey(payer),
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const { value: response } = await connection.simulateTransaction(
    new VersionedTransaction(txMessage),
    {
      sigVerify: false,
    },
  );

  if (response.err !== null) {
    throw new Error('Transaction simulation failed', { cause: response.err });
  }

  return response;
}

/**
 * Finds the Solana cluster targeted by a connection by comparing its genesis hash with each
 *   cluster's.
 *
 * Note that Solana devnet is what Wormhole calls "testnet" while Solana testnet is not really used
 *   in the Wormhole ecosystem. If you want to get the Wormhole network, call `wormholeNetworkFromConnection`.
 * @param connection
 * @returns The corresponding Solana cluster, or `undefined` if there is no match, typically in the
 *   case of a local connection.
 */
export async function solanaClusterFromConnection(
  connection: Connection,
): Promise<Cluster | undefined> {
  const initializeCache = async () =>
    (
      await Promise.all(
        (['testnet', 'devnet', 'mainnet-beta'] as const).map((cluster) =>
          new Connection(clusterApiUrl(cluster), 'singleGossip')
            .getGenesisHash()
            .then((genesis) => ({ [genesis]: cluster })),
        ),
      )
    ).reduce((acc, obj) => ({ ...obj, ...acc }), {});

  genesisHashCache ??= await initializeCache();

  return genesisHashCache[await connection.getGenesisHash()];
}
let genesisHashCache: Record<string, Cluster> | undefined;

/**
 * Finds the Wormhole network targeted by a connection by comparing its genesis hash with each
 *   cluster's.
 * @param connection
 * @returns The corresponding Wormhole network, or `undefined` if there is no match, typically in the
 *   case of a local connection.
 */
export async function wormholeNetworkFromConnection(
  connection: Connection,
): Promise<Network | undefined> {
  switch (await solanaClusterFromConnection(connection)) {
    case 'testnet':
      return 'Testnet'; //QUESTION
    case 'devnet':
      return 'Devnet';
    case 'mainnet-beta':
      return 'Mainnet';
  }
}

/**
 * Gets the data returned from a transaction runned against an Anchor program.
 * @param typeLayout The layout of the returned data.
 * @param confirmedTransaction The transaction having returned the data.
 * @returns
 */
export function returnedDataFromTransaction<L extends Layout>(
  typeLayout: L,
  confirmedTransaction:
    | VersionedTransactionResponse
    | TransactionResponse
    | SimulatedTransactionResponse,
): LayoutToType<L> {
  const prefix = 'Program return: ';
  const logs =
    'meta' in confirmedTransaction
      ? confirmedTransaction.meta?.logMessages
      : confirmedTransaction.logs;
  if (logs == null) {
    throw new Error('Internal error: No logs in this transaction');
  }

  const log = logs.find((log) => log.startsWith(prefix));
  if (log === undefined) {
    throw new Error('No returned value specified in these logs');
  }

  // The line looks like 'Program return: <Public Key> <base64 encoded value>':
  const [, data] = log.slice(prefix.length).split(' ', 2);

  return deserializeLayout<L>(typeLayout, Buffer.from(data ?? '', 'base64'), {
    consumeAll: true,
  });
}
