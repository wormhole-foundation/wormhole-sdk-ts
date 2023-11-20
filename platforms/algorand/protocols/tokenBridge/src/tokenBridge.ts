import {
  ChainId,
  Network,
  toChainId,
  toChainName,
  TokenBridge,
  ChainAddress,
  TokenId,
  UniversalAddress,
  toNative,
  ErrNotWrapped,
  NativeAddress,
  ChainsConfig,
  Contracts,
} from '@wormhole-foundation/connect-sdk';
import {
  Algodv2,
  bigIntToBytes,
  decodeAddress,
  getApplicationAddress,
  SuggestedParams,
  makeApplicationCallTxnFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
  OnApplicationComplete,
  Transaction,
} from 'algosdk';

import {
  AlgorandChainName,
  AlgorandPlatform,
  AnyAlgorandAddress,
  AlgorandUnsignedTransaction,
  AlgorandAddress,
  Signer,
} from '@wormhole-foundation/connect-sdk-algorand';

import {
  calcLogicSigAccount,
  checkBitsSet,
  decodeLocalState,
  textToUint8Array,
  getXAlgoNative,
  _parseVAAAlgorand,
  _submitVAAAlgorand,
  safeBigIntToNumber,
  uint8ArrayToHex,
  textToHexString,
  optin,
  createUnsignedTx,
  getMessageFee,
  MAX_BITS,
  transferFromAlgorand,
  TransactionSignerPair,
} from './utils';

// Functionality of the AlgoranTokenBridge follows similar logic to the one
// found in:
//  https://github.com/wormhole-foundation/wormhole/tree/38f02fa2fc8e80fc3af213959fe397cc6a936778/sdk/js/src/token_bridge
export class AlgorandTokenBridge implements TokenBridge<'Algorand'> {
  readonly chainId: ChainId;

  readonly tokenBridgeAddress: string;
  readonly coreAddress: string;

  private constructor(
    readonly network: Network,
    readonly chain: AlgorandChainName,
    readonly connection: Algodv2,
    readonly contracts: Contracts,
  ) {
    this.chainId = toChainId(chain);

    const tokenBridgeAddress = contracts.tokenBridge;
    if (!tokenBridgeAddress)
      throw new Error(
        `TokenBridge contract Address for chain ${chain} not found`,
      );
    this.tokenBridgeAddress = tokenBridgeAddress;

    const coreBridgeAddress = contracts.coreBridge;
    if (!coreBridgeAddress)
      throw new Error(
        `CoreBridge contract Address for chain ${chain} not found`,
      );

    this.coreAddress = coreBridgeAddress;
  }

  static async fromRpc(
    provider: Algodv2,
    config: ChainsConfig,
  ): Promise<AlgorandTokenBridge> {
    const [network, chain] = await AlgorandPlatform.chainFromRpc(provider);
    return new AlgorandTokenBridge(
      network,
      chain,
      provider,
      config[chain]!.contracts!,
    );
  }

  async isWrappedAsset(token: AlgorandAddress): Promise<boolean> {
    if (token.toString() === 'native') {
      return false;
    }

    const assetInfo = await this.connection
      .getAssetByID(safeBigIntToNumber(BigInt(token.toString())))
      .do();
    const creatorAddr = assetInfo['params'].creator;
    const creatorAcctInfo = await this.connection
      .accountInformation(creatorAddr)
      .do();

    return creatorAcctInfo['auth-addr'] === this.tokenBridgeAddress;
  }

  async getOriginalAsset(token: AlgorandAddress): Promise<TokenId> {
    if (!(await this.isWrappedAsset(token)))
      throw ErrNotWrapped(token.toString());

    const assetInfo = await this.connection
      .getAssetByID(safeBigIntToNumber(BigInt(token.toString())))
      .do();
    const lsa = assetInfo['params'].creator;
    const dls = await decodeLocalState(
      this.connection,
      BigInt(this.tokenBridgeAddress),
      lsa,
    );
    const dlsBuffer: Buffer = Buffer.from(dls);
    const chain = dlsBuffer.readInt16BE(92) as ChainId;
    const assetAddress = new Uint8Array(dlsBuffer.slice(60, 60 + 32));

    return {
      chain: toChainName(chain),
      address: new UniversalAddress(assetAddress),
    };
  }

  async getWrappedNative(): Promise<NativeAddress<'Algorand'>> {
    return toNative(this.chain, getXAlgoNative(this.network));
  }

  async hasWrappedAsset(token: TokenId): Promise<boolean> {
    try {
      await this.getWrappedAsset(token);
      return true;
    } catch (_) {}
    return false;
  }

  async getWrappedAsset(token: TokenId): Promise<NativeAddress<'Algorand'>> {
    throw new Error('Method not implemented.');
  }

  // Checks if a transfer VAA has been redeemed
  async isTransferCompleted(
    vaa: TokenBridge.VAA<'Transfer' | 'TransferWithPayload'>,
  ): Promise<boolean> {
    const parsedVAA = _parseVAAAlgorand(vaa.hash);
    const seq: bigint = parsedVAA.sequence;
    const chainRaw: string = parsedVAA.chainRaw; // this needs to be a hex string
    const em: string = parsedVAA.emitter; // this needs to be a hex string
    const { doesExist, lsa } = await calcLogicSigAccount(
      this.connection,
      BigInt(this.tokenBridgeAddress),
      seq / BigInt(MAX_BITS),
      chainRaw + em,
    );
    if (!doesExist) {
      return false;
    }
    const seqAddr = lsa.address();
    const retVal: boolean = await checkBitsSet(
      this.connection,
      BigInt(this.tokenBridgeAddress),
      seqAddr,
      seq,
    );
    return retVal;
  }

  /**
   * Attest an already created asset
   * If you create a new asset on algorand and want to transfer it elsewhere,
   * you create an attestation for it on Algorand... pass that vaa to the target chain..
   * submit it.. then you can transfer from algorand to that target chain
   */
  async *createAttestation(
    token: AlgorandAddress,
    payer?: AnyAlgorandAddress,
  ): AsyncGenerator<AlgorandUnsignedTransaction> {
    if (!payer) throw new Error('Payer required to create attestation');
    const senderAddr = new AlgorandAddress(payer).unwrap();

    let txs: TransactionSignerPair[] = [];

    let assetId = BigInt(0);
    if (token.toString() === 'native') {
      assetId = BigInt(0);
    } else {
      assetId = BigInt(token.toString());
    }

    const tbAddr: string = getApplicationAddress(
      BigInt(this.tokenBridgeAddress),
    );
    const decTbAddr: Uint8Array = decodeAddress(tbAddr).publicKey;
    const aa: string = uint8ArrayToHex(decTbAddr);

    // "attestFromAlgorand::emitterAddr"
    const { addr: emitterAddr, txs: emitterOptInTxs } = await optin(
      this.connection,
      senderAddr,
      BigInt(this.coreAddress),
      BigInt(0),
      aa,
    );
    txs.push(...emitterOptInTxs);

    let creatorAddr = '';
    let creatorAcctInfo;
    const bPgmName: Uint8Array = textToUint8Array('attestToken');

    if (assetId !== BigInt(0)) {
      const assetInfo = await this.connection
        .getAssetByID(safeBigIntToNumber(assetId))
        .do();
      creatorAcctInfo = await this.connection
        .accountInformation(assetInfo['params'].creator)
        .do();
      if (creatorAcctInfo['auth-addr'] === tbAddr) {
        throw new Error('Cannot re-attest wormhole assets');
      }
    }

    const result = await optin(
      this.connection,
      senderAddr,
      BigInt(this.tokenBridgeAddress),
      assetId,
      textToHexString('native'),
    );
    creatorAddr = result.addr;
    txs.push(...result.txs);

    const suggParams: SuggestedParams = await this.connection
      .getTransactionParams()
      .do();

    const firstTxn = makeApplicationCallTxnFromObject({
      from: senderAddr,
      appIndex: safeBigIntToNumber(BigInt(this.tokenBridgeAddress)),
      onComplete: OnApplicationComplete.NoOpOC,
      appArgs: [textToUint8Array('nop')],
      suggestedParams: suggParams,
    });
    txs.push({ tx: firstTxn, signer: null });

    const mfee = await getMessageFee(this.connection, BigInt(this.coreAddress));
    if (mfee > BigInt(0)) {
      const feeTxn = makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        suggestedParams: suggParams,
        to: getApplicationAddress(BigInt(this.tokenBridgeAddress)),
        amount: mfee,
      });
      txs.push({ tx: feeTxn, signer: null });
    }

    let accts: string[] = [
      emitterAddr,
      creatorAddr,
      getApplicationAddress(BigInt(this.coreAddress)),
    ];

    if (creatorAcctInfo) {
      accts.push(creatorAcctInfo['address']);
    }

    let appTxn = makeApplicationCallTxnFromObject({
      appArgs: [bPgmName, bigIntToBytes(assetId, 8)],
      accounts: accts,
      appIndex: safeBigIntToNumber(BigInt(this.tokenBridgeAddress)),
      foreignApps: [safeBigIntToNumber(BigInt(this.coreAddress))],
      foreignAssets: [safeBigIntToNumber(assetId)],
      from: senderAddr,
      onComplete: OnApplicationComplete.NoOpOC,
      suggestedParams: suggParams,
    });
    if (mfee > BigInt(0)) {
      appTxn.fee *= 3;
    } else {
      appTxn.fee *= 2;
    }

    txs.push({ tx: appTxn, signer: null });

    let i = 0;
    for (const tx of txs) {
      if (tx.signer) {
        yield this.createUnsignedTx(
          tx.tx,
          `Create Attestation ${i.toString()}`,
          tx.signer,
          true,
        );
      } else {
        yield this.createUnsignedTx(
          tx.tx,
          `Create Attestation ${i.toString()}`,
          null,
          true,
        );
      }
      i++;
    }
  }

  // Submit the Token Attestation VAA to the Token bridge
  // to create the wrapped token represented by the data in the VAA
  async *submitAttestation(
    vaa: TokenBridge.VAA<'AttestMeta'>,
    payer?: AnyAlgorandAddress,
  ): AsyncGenerator<AlgorandUnsignedTransaction> {
    const senderAddr = new AlgorandAddress(payer).unwrap();

    const txs = await _submitVAAAlgorand(
      this.connection,
      BigInt(this.tokenBridgeAddress),
      BigInt(this.coreAddress),
      vaa,
      senderAddr,
      this.chain,
      this.network,
    );

    let i = 0;
    for (const tx of txs) {
      if (tx.signer) {
        yield this.createUnsignedTx(
          tx.tx,
          `Submit Attestation ${i.toString()}`,
          tx.signer,
          true,
        );
      } else {
        yield this.createUnsignedTx(
          tx.tx,
          `Submit Attestation ${i.toString()}`,
          null,
          true,
        );
      }
      i++;
    }
  }

  // Transfers an asset from Algorand to a recipient on another chain
  async *transfer(
    sender: AnyAlgorandAddress,
    recipient: ChainAddress,
    token: AlgorandAddress,
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<AlgorandUnsignedTransaction> {
    let assetId = BigInt(0);
    if (token.toString() === 'native') {
      assetId = BigInt(0);
    } else {
      assetId = BigInt(token.toString());
    }

    const fee = BigInt(0);
    const txs = await transferFromAlgorand(
      this.connection,
      BigInt(this.tokenBridgeAddress),
      BigInt(this.coreAddress),
      sender.toString(),
      assetId,
      amount,
      recipient.address.toString(),
      recipient.chain,
      fee,
      payload,
    );

    let i = 0;
    for await (const tx of txs) {
      if (tx.signer) {
        yield this.createUnsignedTx(
          tx.tx,
          `Transfer ${i.toString()}`,
          tx.signer,
          true,
        );
      } else {
        yield this.createUnsignedTx(
          tx.tx,
          `Transfer ${i.toString()}`,
          null,
          true,
        );
      }
      i++;
    }
  }

  // Redeem a transfer VAA to receive the tokens on this chain
  async *redeem(
    sender: AnyAlgorandAddress,
    vaa: TokenBridge.VAA<'Transfer' | 'TransferWithPayload'>,
    unwrapNative?: boolean, //default: true
  ): AsyncGenerator<AlgorandUnsignedTransaction> {
    const senderAddr = sender.toString();
    const txs = await _submitVAAAlgorand(
      this.connection,
      BigInt(this.tokenBridgeAddress),
      BigInt(this.coreAddress),
      vaa,
      senderAddr,
      this.chain,
      this.network,
    );

    let i = 0;
    for await (const tx of txs) {
      if (tx.signer) {
        yield this.createUnsignedTx(
          tx.tx,
          `Redeem ${i.toString()}`,
          tx.signer,
          true,
        );
      } else {
        yield this.createUnsignedTx(
          tx.tx,
          `Redeem ${i.toString()}`,
          null,
          true,
        );
      }
      i++;
    }
  }

  private createUnsignedTx(
    txReq: Transaction,
    description: string,
    signer: Signer | null = null,
    parallelizable: boolean = false,
  ): AlgorandUnsignedTransaction {
    return createUnsignedTx(
      txReq,
      description,
      this.network,
      signer,
      parallelizable,
    );
  }
}
