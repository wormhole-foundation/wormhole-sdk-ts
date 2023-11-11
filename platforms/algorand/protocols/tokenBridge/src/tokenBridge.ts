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
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  OnApplicationComplete,
  Transaction,
} from 'algosdk';

import {
  AlgorandChainName,
  AlgorandPlatform,
  AlgorandAssetId,
  AnyAlgorandAddress,
  AlgorandUnsignedTransaction,
  AlgorandAddress,
} from '@wormhole-foundation/connect-sdk-algorand';

import {
  calcLogicSigAccount,
  checkBitsSet,
  decodeLocalState,
  textToUint8Array,
  hexToUint8Array,
  getXAlgoNative,
  _parseVAAAlgorand,
  _submitVAAAlgorand,
  safeBigIntToNumber,
  TransactionSignerPair,
  uint8ArrayToHex,
  textToHexString,
  optin,
  assetOptinCheck,
  createUnsignedTx,
  getMessageFee,
  getEmitterAddressAlgorand,
  MAX_BITS,
  submitVAAHeader,
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

  async isWrappedAsset(token: AlgorandAssetId): Promise<boolean> {
    if (token === BigInt(0)) {
      return false;
    }

    const assetInfo = await this.connection
      .getAssetByID(safeBigIntToNumber(token))
      .do();
    const creatorAddr = assetInfo['params'].creator;
    const creatorAcctInfo = await this.connection
      .accountInformation(creatorAddr)
      .do();

    return creatorAcctInfo['auth-addr'] === this.tokenBridgeAddress;
  }

  async getOriginalAsset(token: AlgorandAssetId): Promise<TokenId> {
    if (!(await this.isWrappedAsset(token)))
      throw ErrNotWrapped(token.toString());

    const assetInfo = await this.connection
      .getAssetByID(safeBigIntToNumber(token))
      .do();
    const lsa = assetInfo['params'].creator;
    const dls = await decodeLocalState(
      this.connection,
      this.tokenBridgeAddress,
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
    token: AlgorandAssetId,
    payer?: AnyAlgorandAddress,
  ): AsyncGenerator<AlgorandUnsignedTransaction> {
    if (!payer) throw new Error('Payer required to create attestation');
    const senderAddr = new AlgorandAddress(payer).unwrap();

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
    // txs.push(...emitterOptInTxs);
    for (const tx of emitterOptInTxs) {
      yield this.createUnsignedTx(tx.tx, 'Algorand.AttestTokenOptin');
    }

    let creatorAddr = '';
    let creatorAcctInfo;
    const bPgmName: Uint8Array = textToUint8Array('attestToken');

    if (token !== BigInt(0)) {
      const assetInfo = await this.connection
        .getAssetByID(safeBigIntToNumber(token))
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
      token,
      textToHexString('native'),
    );
    creatorAddr = result.addr;
    // txs.push(...result.txs);
    for (const tx of result.txs) {
      yield this.createUnsignedTx(tx.tx, 'Algorand.AttestTokenOptin');
    }

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
    // txs.push({ tx: firstTxn, signer: null });
    yield this.createUnsignedTx(firstTxn, 'Algorand.AttestTokenStart');

    const mfee = await getMessageFee(this.connection, BigInt(this.coreAddress));
    if (mfee > BigInt(0)) {
      const feeTxn = makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        suggestedParams: suggParams,
        to: getApplicationAddress(BigInt(this.tokenBridgeAddress)),
        amount: mfee,
      });
      // txs.push({ tx: feeTxn, signer: null });
      yield this.createUnsignedTx(feeTxn, 'Algorand.AttestTokenFee');
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
      appArgs: [bPgmName, bigIntToBytes(token, 8)],
      accounts: accts,
      appIndex: safeBigIntToNumber(BigInt(this.tokenBridgeAddress)),
      foreignApps: [safeBigIntToNumber(BigInt(this.coreAddress))],
      foreignAssets: [safeBigIntToNumber(token)],
      from: senderAddr,
      onComplete: OnApplicationComplete.NoOpOC,
      suggestedParams: suggParams,
    });
    if (mfee > BigInt(0)) {
      appTxn.fee *= 3;
    } else {
      appTxn.fee *= 2;
    }

    // txs.push({ tx: appTxn, signer: null });
    yield this.createUnsignedTx(appTxn, 'Algorand.AttestToken');
  }

  // Submit the Token Attestation VAA to the Token bridge
  // to create the wrapped token represented by the data in the VAA
  async *submitAttestation(
    vaa: TokenBridge.VAA<'AttestMeta'>,
    payer?: AnyAlgorandAddress,
  ): AsyncGenerator<AlgorandUnsignedTransaction> {
    const senderAddr = new AlgorandAddress(payer).unwrap();
    const { txs } = await submitVAAHeader(
      this.connection,
      BigInt(this.tokenBridgeAddress),
      vaa.hash,
      senderAddr,
      BigInt(this.coreAddress),
    );

    for (const stx of txs) {
      yield this.createUnsignedTx(stx.tx, '');
    }
  }

  // Transfers an asset from Algorand to a recipient on another chain
  async *transfer(
    sender: AnyAlgorandAddress,
    recipient: ChainAddress,
    token: AlgorandAssetId,
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<AlgorandUnsignedTransaction> {
    const senderAddr = sender.toString();

    const mfee = await getMessageFee(
      this.connection,
      BigInt(this.tokenBridgeAddress),
    );

    const recipientChainId = toChainId(recipient.chain);

    const tokenAddr: string = getApplicationAddress(
      BigInt(this.tokenBridgeAddress),
    );
    const applAddr: string = getEmitterAddressAlgorand(
      BigInt(this.tokenBridgeAddress),
    );
    const txs: TransactionSignerPair[] = [];
    // "transferAsset"
    const { addr: emitterAddr, txs: emitterOptInTxs } = await optin(
      this.connection,
      senderAddr,
      BigInt(this.coreAddress),
      BigInt(0),
      applAddr,
    );
    txs.push(...emitterOptInTxs);
    let creator;
    let creatorAcctInfo: any;
    let wormhole: boolean = false;
    if (token !== BigInt(0)) {
      const assetInfo: Record<string, any> = await this.connection
        .getAssetByID(safeBigIntToNumber(token))
        .do();
      creator = assetInfo['params']['creator'];
      creatorAcctInfo = await this.connection.accountInformation(creator).do();
      const authAddr: string = creatorAcctInfo['auth-addr'];
      if (authAddr === tokenAddr) {
        wormhole = true;
      }
    }

    const params: SuggestedParams = await this.connection
      .getTransactionParams()
      .do();
    const msgFee: bigint = await getMessageFee(
      this.connection,
      BigInt(this.coreAddress),
    );
    if (msgFee > 0) {
      const payTxn: Transaction = makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        suggestedParams: params,
        to: getApplicationAddress(BigInt(this.tokenBridgeAddress)),
        amount: msgFee,
      });
      txs.push({ tx: payTxn, signer: null });
    }
    if (!wormhole) {
      const bNat = Buffer.from('native', 'binary').toString('hex');
      // "creator"
      const result = await optin(
        this.connection,
        senderAddr,
        BigInt(this.tokenBridgeAddress),
        token,
        bNat,
      );
      creator = result.addr;
      txs.push(...result.txs);
    }
    if (
      token !== BigInt(0) &&
      !(await assetOptinCheck(this.connection, token, creator))
    ) {
      // Looks like we need to optin
      const payTxn: Transaction = makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        to: creator,
        amount: 100000,
        suggestedParams: params,
      });
      txs.push({ tx: payTxn, signer: null });
      // The tokenid app needs to do the optin since it has signature authority
      const bOptin: Uint8Array = textToUint8Array('optin');
      let txn = makeApplicationCallTxnFromObject({
        from: senderAddr,
        appIndex: safeBigIntToNumber(BigInt(this.tokenBridgeAddress)),
        onComplete: OnApplicationComplete.NoOpOC,
        appArgs: [bOptin, bigIntToBytes(token, 8)],
        foreignAssets: [safeBigIntToNumber(token)],
        accounts: [creator],
        suggestedParams: params,
      });
      txn.fee *= 2;
      txs.push({ tx: txn, signer: null });
    }
    const t = makeApplicationCallTxnFromObject({
      from: senderAddr,
      appIndex: safeBigIntToNumber(BigInt(this.tokenBridgeAddress)),
      onComplete: OnApplicationComplete.NoOpOC,
      appArgs: [textToUint8Array('nop')],
      suggestedParams: params,
    });
    txs.push({ tx: t, signer: null });

    let accounts: string[] = [];
    if (token === BigInt(0)) {
      const t = makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        to: creator,
        amount: amount,
        suggestedParams: params,
      });
      txs.push({ tx: t, signer: null });
      accounts = [emitterAddr, creator, creator];
    } else {
      const t = makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        to: creator,
        suggestedParams: params,
        amount: amount,
        assetIndex: safeBigIntToNumber(token),
      });
      txs.push({ tx: t, signer: null });
      accounts = [emitterAddr, creator, creatorAcctInfo['address']];
    }

    let args = [
      textToUint8Array('sendTransfer'),
      bigIntToBytes(token, 8),
      bigIntToBytes(amount, 8),
      hexToUint8Array(recipient.address.toString()),
      bigIntToBytes(recipientChainId, 8),
      bigIntToBytes(mfee, 8),
    ];
    if (payload !== null) {
      args.push(payload);
    }
    let acTxn = makeApplicationCallTxnFromObject({
      from: senderAddr,
      appIndex: safeBigIntToNumber(BigInt(this.tokenBridgeAddress)),
      onComplete: OnApplicationComplete.NoOpOC,
      appArgs: args,
      foreignApps: [safeBigIntToNumber(BigInt(this.coreAddress))],
      foreignAssets: [safeBigIntToNumber(token)],
      accounts: accounts,
      suggestedParams: params,
    });
    acTxn.fee *= 2;
    txs.push({ tx: acTxn, signer: null });
    return txs;
  }

  // Redeem a transfer VAA to receive the tokens on this chain
  async *redeem(
    sender: AnyAlgorandAddress,
    vaa: TokenBridge.VAA<'Transfer' | 'TransferWithPayload'>,
    unwrapNative?: boolean, //default: true
  ): AsyncGenerator<AlgorandUnsignedTransaction> {
    const senderAddr = sender.toString();
    const txs = _submitVAAAlgorand(
      this.connection,
      BigInt(this.tokenBridgeAddress),
      BigInt(this.coreAddress),
      vaa.hash,
      senderAddr,
      this.chain,
      this.network,
    );

    for await (const tx of txs) {
      yield tx;
    }
  }

  private createUnsignedTx(
    txReq: Transaction,
    description: string,
    parallelizable: boolean = false,
  ): AlgorandUnsignedTransaction {
    return createUnsignedTx(txReq, description, this.network, parallelizable);
  }
}
