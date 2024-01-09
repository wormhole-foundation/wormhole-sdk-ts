import {
  AccountAddress,
  Chain,
  ChainAddress,
  ChainId,
  ChainsConfig,
  Contracts,
  NativeAddress,
  Network,
  Platform,
  TokenAddress,
  TokenBridge,
  TokenId,
  UniversalAddress,
  encoding,
  serialize,
  toChain,
  toChainId,
  toNative,
} from "@wormhole-foundation/connect-sdk";
import {
  AlgorandAddress,
  AlgorandChains,
  AlgorandPlatform,
  AlgorandPlatformType,
  AlgorandUnsignedTransaction,
  AnyAlgorandAddress,
  TransactionSignerPair,
  safeBigIntToNumber,
} from "@wormhole-foundation/connect-sdk-algorand";
import {
  AlgorandWormholeCore,
  StorageLogicSig,
} from "@wormhole-foundation/connect-sdk-algorand-core";
import {
  ABIMethod,
  ABIType,
  Algodv2,
  LogicSigAccount,
  OnApplicationComplete,
  SuggestedParams,
  bigIntToBytes,
  decodeAddress,
  getApplicationAddress,
  makeApplicationCallTxnFromObject,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
  modelsv2,
} from "algosdk";

import "@wormhole-foundation/connect-sdk-algorand-core";

export const TransferMethodSelector = ABIMethod.fromSignature("portal_transfer(byte[])byte[]");

export class AlgorandTokenBridge<N extends Network, C extends AlgorandChains>
  implements TokenBridge<N, AlgorandPlatformType, C>
{
  readonly chainId: ChainId;

  readonly coreBridge: AlgorandWormholeCore<N, C>;
  readonly coreAppId: bigint;
  readonly coreAppAddress: string;

  readonly tokenBridgeAppId: bigint;
  readonly tokenBridgeAddress: string;

  static sendTransfer = encoding.bytes.encode("sendTransfer");
  static attestToken = encoding.bytes.encode("attestToken");
  static noop = encoding.bytes.encode("nop");
  static optIn = encoding.bytes.encode("optin");
  static completeTransfer = encoding.bytes.encode("completeTransfer");
  static receiveAttest = encoding.bytes.encode("receiveAttest");

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: Algodv2,
    readonly contracts: Contracts,
  ) {
    this.chainId = toChainId(chain);

    if (!contracts.coreBridge) {
      throw new Error(`Core contract address for chain ${chain} not found`);
    }
    const core = BigInt(contracts.coreBridge);
    this.coreAppId = core;
    this.coreAppAddress = getApplicationAddress(core);
    this.coreBridge = new AlgorandWormholeCore(network, chain, connection, contracts);

    if (!contracts.tokenBridge) {
      throw new Error(`TokenBridge contract address for chain ${chain} not found`);
    }
    const tokenBridge = BigInt(contracts.tokenBridge);
    this.tokenBridgeAppId = tokenBridge;
    this.tokenBridgeAddress = getApplicationAddress(tokenBridge);
  }

  static async fromRpc<N extends Network>(
    provider: Algodv2,
    config: ChainsConfig<N, Platform>,
  ): Promise<AlgorandTokenBridge<N, AlgorandChains>> {
    const [network, chain] = await AlgorandPlatform.chainFromRpc(provider);

    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new AlgorandTokenBridge(network as N, chain, provider, conf.contracts);
  }

  // Checks a native address to see if it's a wrapped version
  async isWrappedAsset(token: TokenAddress<C>): Promise<boolean> {
    const assetId = new AlgorandAddress(token).toInt();

    if (assetId === 0) return false;

    const assetInfoResp = await this.connection.getAssetByID(assetId).do();
    const asset = modelsv2.Asset.from_obj_for_encoding(assetInfoResp);

    const creatorAddr = asset.params.creator;
    const creatorAcctInfoResp = await this.connection
      .accountInformation(creatorAddr)
      .exclude("all")
      .do();
    const creator = modelsv2.Account.from_obj_for_encoding(creatorAcctInfoResp);
    const isWrapped: boolean = creator?.authAddr === this.tokenBridgeAddress;
    return isWrapped;
  }

  // Returns the original asset with its foreign chain
  async getOriginalAsset(token: TokenAddress<C>): Promise<TokenId> {
    const assetId = new AlgorandAddress(token).toInt();

    const assetInfoResp = await this.connection.getAssetByID(assetId).do();
    const assetInfo = modelsv2.Asset.from_obj_for_encoding(assetInfoResp);
    const decodedLocalState = await StorageLogicSig.decodeLocalState(
      this.connection,
      this.tokenBridgeAppId,
      assetInfo.params.creator,
    );

    if (decodedLocalState.length < 94) throw new Error("Invalid local state data");

    const chainBytes = decodedLocalState.slice(92, 94);
    const chain = toChain(encoding.bignum.decode(chainBytes));
    const address = new UniversalAddress(decodedLocalState.slice(60, 60 + 32));

    return { chain, address };
  }

  // Returns the address of the native version of this asset
  async getWrappedAsset(token: TokenId<Chain>): Promise<NativeAddress<C>> {
    const storageAccount = StorageLogicSig.forWrappedAsset(this.tokenBridgeAppId, token);
    const data = await StorageLogicSig.decodeLocalState(
      this.connection,
      this.tokenBridgeAppId,
      storageAccount.address(),
    );

    if (data.length < 8) throw new Error("Invalid wrapped asset data");
    const nativeAddress = toNative(this.chain, encoding.bignum.decode(data.slice(0, 8)).toString());
    return nativeAddress;
  }

  // Checks if a wrapped version exists
  async hasWrappedAsset(token: TokenId<Chain>): Promise<boolean> {
    try {
      await this.getWrappedAsset(token);
      return true;
    } catch {}
    return false;
  }

  async getWrappedNative(): Promise<NativeAddress<C>> {
    return toNative(this.chain, "0");
  }

  async isTransferCompleted(vaa: TokenBridge.TransferVAA): Promise<boolean> {
    const messageStorage = StorageLogicSig.forMessageId(this.tokenBridgeAppId, {
      sequence: vaa.sequence,
      chain: vaa.emitterChain,
      emitter: vaa.emitterAddress,
    });
    try {
      return await StorageLogicSig.checkBitsSet(
        this.connection,
        this.tokenBridgeAppId,
        messageStorage.address(),
        vaa.sequence,
      );
    } catch {}
    return false;
  }

  // Creates a Token Attestation VAA containing metadata about
  // the token that may be submitted to a Token Bridge on another chain
  // to allow it to create a wrapped version of the token
  async *createAttestation(token: TokenAddress<C>, payer?: AnyAlgorandAddress) {
    if (!payer) throw new Error("Payer required to create attestation");

    const senderAddr = new AlgorandAddress(payer).toString();
    const assetId = new AlgorandAddress(token).toInt();

    const txs: TransactionSignerPair[] = [];

    const suggestedParams: SuggestedParams = await this.connection.getTransactionParams().do();

    const tbs = StorageLogicSig.forEmitter(
      this.coreAppId,
      new AlgorandAddress(this.tokenBridgeAddress).toUint8Array(),
    );

    const {
      accounts: [emitterAddr],
      txs: emitterOptInTxs,
    } = await AlgorandWormholeCore.maybeCreateStorageTx(
      this.connection,
      senderAddr,
      this.coreAppId,
      tbs,
      suggestedParams,
    );
    txs.push(...emitterOptInTxs);

    let creatorAddr = "";
    let creatorAcctInfo;

    if (assetId !== 0) {
      const assetInfoResp = await this.connection.getAssetByID(assetId).do();
      const assetInfo = modelsv2.Asset.from_obj_for_encoding(assetInfoResp);
      const creatorAcctInfoResp = await this.connection
        .accountInformation(assetInfo.params.creator)
        .do();
      creatorAcctInfo = modelsv2.Account.from_obj_for_encoding(creatorAcctInfoResp);
      if (creatorAcctInfo.authAddr === this.tokenBridgeAddress.toString()) {
        throw new Error("Cannot re-attest wormhole assets");
      }
    }

    const nativeStorageAcct = StorageLogicSig.forNativeAsset(
      this.tokenBridgeAppId,
      BigInt(assetId),
    );
    const txns = await AlgorandWormholeCore.maybeCreateStorageTx(
      this.connection,
      senderAddr,
      this.tokenBridgeAppId,
      nativeStorageAcct,
    );
    creatorAddr = txns.accounts[0]!;
    txs.push(...txns.txs);

    const firstTxn = makeApplicationCallTxnFromObject({
      from: senderAddr,
      appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
      onComplete: OnApplicationComplete.NoOpOC,
      appArgs: [AlgorandTokenBridge.noop],
      suggestedParams,
    });
    txs.push({ tx: firstTxn });

    const mfee = await this.coreBridge.getMessageFee();
    if (mfee > BigInt(0)) {
      const feeTxn = makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        suggestedParams,
        to: this.tokenBridgeAddress,
        amount: mfee,
      });
      txs.push({ tx: feeTxn });
    }

    let accts: string[] = [emitterAddr!, creatorAddr, this.coreAppAddress];

    if (creatorAcctInfo) {
      accts.push(creatorAcctInfo.address);
    }

    let appTxn = makeApplicationCallTxnFromObject({
      appArgs: [AlgorandTokenBridge.attestToken, encoding.bignum.toBytes(assetId, 8)],
      accounts: accts,
      appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
      foreignApps: [safeBigIntToNumber(this.coreAppId)],
      foreignAssets: [assetId],
      from: senderAddr,
      onComplete: OnApplicationComplete.NoOpOC,
      suggestedParams,
    });
    if (mfee > BigInt(0)) {
      appTxn.fee *= 3;
    } else {
      appTxn.fee *= 2;
    }
    txs.push({ tx: appTxn });

    for (const utxn of txs) {
      yield this.createUnsignedTx(utxn, "TokenBridge.createAttestation", true);
    }
  }

  // Submits the Token Attestation VAA to the Token Bridge
  // to create the wrapped token represented by the data in the VAA
  async *submitAttestation(
    vaa: TokenBridge.AttestVAA,
    sender?: AnyAlgorandAddress,
    suggestedParams?: SuggestedParams,
  ): AsyncGenerator<AlgorandUnsignedTransaction<N, C>> {
    if (!sender) throw new Error("Sender required to submit attestation");
    if (!suggestedParams) suggestedParams = await this.connection.getTransactionParams().do();

    const senderAddr = sender.toString();

    const tokenStorage = StorageLogicSig.forWrappedAsset(this.tokenBridgeAppId, vaa.payload.token);
    const tokenStorageAddress = tokenStorage.address();

    const txs: TransactionSignerPair[] = [];
    const foreignAssets: number[] = [];

    const data: Uint8Array = await StorageLogicSig.decodeLocalState(
      this.connection,
      this.tokenBridgeAppId,
      tokenStorageAddress,
    );

    if (data.length > 8) {
      foreignAssets.push(new AlgorandAddress(data.slice(0, 8)).toInt());
    }

    txs.push({
      tx: makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        to: tokenStorageAddress,
        amount: 100000,
        suggestedParams,
      }),
    });

    let buf: Uint8Array = new Uint8Array(1);
    buf[0] = 0x01;
    txs.push({
      tx: makeApplicationCallTxnFromObject({
        appArgs: [AlgorandTokenBridge.noop, buf],
        appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
        from: senderAddr,
        onComplete: OnApplicationComplete.NoOpOC,
        suggestedParams,
      }),
    });

    buf = new Uint8Array(1);
    buf[0] = 0x02;
    txs.push({
      tx: makeApplicationCallTxnFromObject({
        appArgs: [AlgorandTokenBridge.noop, buf],
        appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
        from: senderAddr,
        onComplete: OnApplicationComplete.NoOpOC,
        suggestedParams,
      }),
    });

    txs.push({
      tx: makeApplicationCallTxnFromObject({
        accounts: [],
        appArgs: [AlgorandTokenBridge.receiveAttest, serialize(vaa)],
        appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
        foreignAssets: foreignAssets,
        from: senderAddr,
        onComplete: OnApplicationComplete.NoOpOC,
        suggestedParams,
      }),
    });

    txs[txs.length - 1]!.tx.fee = txs[txs.length - 1]!.tx.fee * 2;

    for (const utxn of txs) {
      yield this.createUnsignedTx(utxn, "TokenBridge.submitAttestation", true);
    }
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress<C>,
    token: TokenAddress<C>,
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<AlgorandUnsignedTransaction<N, C>> {
    const senderAddr = sender.toString();
    const assetId = token === "native" ? 0 : new AlgorandAddress(token).toInt();
    const qty = amount;
    const chainId = toChainId(recipient.chain);
    const receiver = recipient.address.toUniversalAddress().toUint8Array();

    const suggestedParams: SuggestedParams = await this.connection.getTransactionParams().do();

    const fee = BigInt(0);

    const tbs = StorageLogicSig.fromData({
      appId: this.coreAppId,
      appAddress: decodeAddress(this.coreAppAddress).publicKey,
      idx: BigInt(0),
      address: decodeAddress(this.tokenBridgeAddress).publicKey,
    });

    const txs: TransactionSignerPair[] = [];
    const {
      accounts: [emitterAddr],
      txs: emitterOptInTxs,
    } = await AlgorandWormholeCore.maybeCreateStorageTx(
      this.connection,
      senderAddr,
      this.coreAppId,
      tbs,
      suggestedParams,
    );
    txs.push(...emitterOptInTxs);

    // Check that the auth address of the creator is the token bridge
    let creator = "";
    let creatorAcct: modelsv2.Account | undefined;
    let wormhole: boolean = false;
    if (assetId !== 0) {
      const assetInfoResp: Record<string, any> = await this.connection.getAssetByID(assetId).do();
      const asset = modelsv2.Asset.from_obj_for_encoding(assetInfoResp);
      creator = asset.params.creator;

      const creatorAcctInfoResp = await this.connection.accountInformation(creator).do();
      creatorAcct = modelsv2.Account.from_obj_for_encoding(creatorAcctInfoResp);
      wormhole = creatorAcct.authAddr === this.tokenBridgeAddress.toString();
    }

    const msgFee: bigint = await this.coreBridge.getMessageFee();
    if (msgFee > 0)
      txs.push({
        tx: makePaymentTxnWithSuggestedParamsFromObject({
          from: senderAddr,
          to: this.tokenBridgeAddress,
          amount: msgFee,
          suggestedParams,
        }),
      });

    if (!wormhole) {
      const nativeStorageAccount = StorageLogicSig.forNativeAsset(
        this.tokenBridgeAppId,
        BigInt(assetId),
      );
      const {
        accounts: [address],
        txs,
      } = await AlgorandWormholeCore.maybeCreateStorageTx(
        this.connection,
        senderAddr,
        this.tokenBridgeAppId,
        nativeStorageAccount,
        suggestedParams,
      );
      creator = address!;
      txs.push(...txs);
    }

    if (
      assetId !== 0 &&
      !(await AlgorandTokenBridge.isOptedInToAsset(this.connection, creator, assetId))
    ) {
      // Looks like we need to optin
      const payTxn = makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        to: creator,
        amount: 100000,
        suggestedParams,
      });
      txs.unshift({ tx: payTxn });
      // The tokenid app needs to do the optin since it has signature authority
      let txn = makeApplicationCallTxnFromObject({
        from: senderAddr,
        appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
        onComplete: OnApplicationComplete.NoOpOC,
        appArgs: [AlgorandTokenBridge.optIn, bigIntToBytes(assetId, 8)],
        foreignAssets: [assetId],
        accounts: [creator],
        suggestedParams,
      });
      txn.fee *= 2;
      txs.unshift({ tx: txn });
    }

    const t = makeApplicationCallTxnFromObject({
      from: senderAddr,
      appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
      onComplete: OnApplicationComplete.NoOpOC,
      appArgs: [AlgorandTokenBridge.noop],
      suggestedParams,
    });
    txs.push({ tx: t });

    let accounts: string[] = [];
    if (assetId === 0) {
      const t = makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        to: creator,
        amount: qty,
        suggestedParams,
      });
      txs.push({ tx: t });
      accounts = [emitterAddr!, creator, creator];
    } else {
      const t = makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        to: creator,
        amount: qty,
        assetIndex: assetId,
        suggestedParams,
      });
      txs.push({ tx: t });
      accounts = creatorAcct?.address
        ? [emitterAddr!, creator, creatorAcct.address]
        : [emitterAddr!, creator];
    }

    const args = [
      AlgorandTokenBridge.sendTransfer,
      encoding.bignum.toBytes(assetId, 8),
      encoding.bignum.toBytes(qty, 8),
      receiver,
      encoding.bignum.toBytes(chainId, 8),
      encoding.bignum.toBytes(fee, 8),
    ];

    if (payload) args.push(payload);

    const acTxn = makeApplicationCallTxnFromObject({
      from: senderAddr,
      appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
      onComplete: OnApplicationComplete.NoOpOC,
      appArgs: args,
      foreignApps: [safeBigIntToNumber(this.coreAppId)],
      foreignAssets: [assetId],
      accounts: accounts,
      suggestedParams,
    });
    acTxn.fee *= 2;
    txs.push({ tx: acTxn });

    for (const utxn of txs) {
      yield this.createUnsignedTx(utxn, "TokenBridge.transfer", true);
    }
  }

  async *redeem(
    sender: AnyAlgorandAddress,
    vaa: TokenBridge.TransferVAA,
    unwrapNative: boolean = true,
    suggestedParams?: SuggestedParams,
  ) {
    if (!suggestedParams) suggestedParams = await this.connection.getTransactionParams().do();

    const senderAddr = new AlgorandAddress(sender).toString();

    const { accounts, txs } = await AlgorandWormholeCore.submitVAAHeader(
      this.connection,
      this.coreAppId,
      this.tokenBridgeAppId,
      vaa,
      senderAddr,
    );

    // A critical routing step occurs here
    let tokenStorage: LogicSigAccount | undefined = undefined;
    let tokenStorageAddress: string = "";
    let foreignAssets: number[] = [];
    let assetId: number = 0;
    if (vaa.payload.token.chain !== this.chain) {
      // If the token is from elsewhere we get the storage lsig for a wrapped asset
      tokenStorage = StorageLogicSig.forWrappedAsset(this.tokenBridgeAppId, vaa.payload.token);
      tokenStorageAddress = tokenStorage.address();
      const data = await StorageLogicSig.decodeLocalState(
        this.connection,
        this.tokenBridgeAppId,
        tokenStorageAddress,
      );
      assetId = new AlgorandAddress(data.slice(0, 8)).toInt();
    } else {
      // Otherwise we get the storage lsig for a native asset, including ALGO (0)
      const nativeTokenId = new AlgorandAddress(vaa.payload.token.address).toBigInt();
      tokenStorage = StorageLogicSig.forNativeAsset(this.tokenBridgeAppId, nativeTokenId);
      tokenStorageAddress = tokenStorage.address();
      assetId = safeBigIntToNumber(nativeTokenId);
    }
    accounts.push(tokenStorageAddress);

    let appId = 0;
    let receiverAddress = "";
    if (vaa.payloadName === "TransferWithPayload") {
      appId = new AlgorandAddress(vaa.payload.to.address).toInt();
      receiverAddress = getApplicationAddress(appId);
    } else {
      receiverAddress = new AlgorandAddress(vaa.payload.to.address.toUint8Array()).toString();
    }
    accounts.push(receiverAddress);

    if (assetId !== 0) {
      foreignAssets.push(assetId);
      if (
        !(await AlgorandTokenBridge.isOptedInToAsset(this.connection, receiverAddress, assetId))
      ) {
        if (senderAddr != receiverAddress) {
          throw new Error("Cannot ASA optin for somebody else (asset " + assetId.toString() + ")");
        }

        // Push asset opt in to the front
        txs.unshift({
          tx: makeAssetTransferTxnWithSuggestedParamsFromObject({
            amount: 0,
            assetIndex: assetId,
            from: senderAddr,
            suggestedParams,
            to: senderAddr,
          }),
        });
      }
    }

    const appCallObj = {
      accounts: accounts,
      appArgs: [AlgorandTokenBridge.completeTransfer, serialize(vaa)],
      appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
      foreignAssets: foreignAssets,
      from: senderAddr,
      onComplete: OnApplicationComplete.NoOpOC,
      suggestedParams,
    };

    txs.push({
      tx: makeApplicationCallTxnFromObject(appCallObj),
    });

    // We need to cover the inner transactions
    txs[txs.length - 1]!.tx.fee =
      txs[txs.length - 1]!.tx.fee *
      (vaa.payloadName === "Transfer" && vaa.payload.fee !== undefined && vaa.payload.fee === 0n
        ? 2
        : 3);

    if (vaa.payloadName === "TransferWithPayload") {
      txs[txs.length - 1]!.tx.appForeignApps = [appId];

      txs.push({
        tx: makeApplicationCallTxnFromObject({
          appArgs: [
            TransferMethodSelector.getSelector(),
            (TransferMethodSelector.args[0]!.type as ABIType).encode(serialize(vaa)),
          ],
          appIndex: appId,
          foreignAssets: foreignAssets,
          from: senderAddr,
          onComplete: OnApplicationComplete.NoOpOC,
          suggestedParams,
        }),
      });
    }

    for (const utxn of txs) {
      yield this.createUnsignedTx(utxn, "TokenBridge.redeem", true);
    }
  }

  /**
   * Checks if the asset has been opted in by the receiver
   * @param client Algodv2 client
   * @param asset Algorand asset index
   * @param receiver Account address
   * @returns Promise with True if the asset was opted in, False otherwise
   */
  static async isOptedInToAsset(client: Algodv2, address: string, asset: number): Promise<boolean> {
    try {
      const acctInfoResp = await client.accountAssetInformation(address, asset).do();
      const acctInfo = modelsv2.AccountAssetResponse.from_obj_for_encoding(acctInfoResp);
      return (acctInfo.assetHolding?.amount ?? 0) > 0;
    } catch {}
    return false;
  }

  private createUnsignedTx(
    txReq: TransactionSignerPair,
    description: string,
    parallelizable: boolean = true, // Default true for Algorand atomic transaction grouping
  ): AlgorandUnsignedTransaction<N, C> {
    return new AlgorandUnsignedTransaction(
      txReq,
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
