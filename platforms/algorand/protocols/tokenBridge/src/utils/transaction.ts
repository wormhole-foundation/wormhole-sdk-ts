import { AlgorandUnsignedTransaction } from '@wormhole-foundation/connect-sdk-algorand';

import { Network } from '@wormhole-foundation/connect-sdk';

import {
  Algodv2,
  getApplicationAddress,
  makePaymentTxnWithSuggestedParamsFromObject,
  makeApplicationOptInTxnFromObject,
  signLogicSigTransaction,
  Transaction,
} from 'algosdk';

import { calcLogicSigAccount } from './decode';
import { accountExistsCache } from './account';
import { safeBigIntToNumber } from './conversions';
import { SEED_AMT } from './constants';

type Signer = {
  addr: string;
  signTxn(txn: Transaction): Promise<Uint8Array>;
};

export type TransactionSignerPair = {
  tx: Transaction;
  signer: Signer | null;
};

export type OptInResult = {
  addr: string;
  txs: TransactionSignerPair[];
};

/**
 * Calculates the logic sig account for the application
 * @param client An Algodv2 client
 * @param senderAddr Sender address
 * @param appId Application ID
 * @param appIndex Application index
 * @param emitterId Emitter address
 * @returns Address and array of TransactionSignerPairs
 */
export async function optin(
  client: Algodv2,
  senderAddr: string,
  appId: bigint,
  appIndex: bigint,
  emitterId: string,
): Promise<OptInResult> {
  const appAddr: string = getApplicationAddress(appId);

  // Check to see if we need to create this
  const { doesExist, lsa } = await calcLogicSigAccount(
    client,
    appId,
    appIndex,
    emitterId,
  );
  const sigAddr: string = lsa.address();
  let txs: TransactionSignerPair[] = [];
  if (!doesExist) {
    // These are the suggested params from the system
    const params = await client.getTransactionParams().do();
    const seedTxn = makePaymentTxnWithSuggestedParamsFromObject({
      from: senderAddr,
      to: sigAddr,
      amount: SEED_AMT,
      suggestedParams: params,
    });
    seedTxn.fee = seedTxn.fee * 2;
    txs.push({ tx: seedTxn, signer: null });
    const optinTxn = makeApplicationOptInTxnFromObject({
      from: sigAddr,
      suggestedParams: params,
      appIndex: safeBigIntToNumber(appId),
      rekeyTo: appAddr,
    });
    optinTxn.fee = 0;
    txs.push({
      tx: optinTxn,
      signer: {
        addr: lsa.address(),
        signTxn: (txn: Transaction) =>
          Promise.resolve(signLogicSigTransaction(txn, lsa).blob),
      },
    });

    accountExistsCache.add([appId, lsa.address()]);
  }
  return {
    addr: sigAddr,
    txs,
  };
}

/**
 * Checks if the asset has been opted in by the receiver
 * @param client Algodv2 client
 * @param asset Algorand asset index
 * @param receiver Account address
 * @returns True if the asset was opted in, else false
 */
export async function assetOptinCheck(
  client: Algodv2,
  asset: bigint,
  receiver: string,
): Promise<boolean> {
  const acctInfo = await client.accountInformation(receiver).do();
  const assets: Array<any> = acctInfo['assets'];
  let ret = false;
  assets.forEach((a) => {
    const assetId = BigInt(a['asset-id']);
    if (assetId === asset) {
      ret = true;
      return;
    }
  });
  return ret;
}

export function createUnsignedTx(
  txReq: Transaction,
  description: string,
  network: Network,
  parallelizable: boolean = false,
): AlgorandUnsignedTransaction {
  return new AlgorandUnsignedTransaction(
    txReq,
    network,
    'Algorand',
    description,
    parallelizable,
  );
}
