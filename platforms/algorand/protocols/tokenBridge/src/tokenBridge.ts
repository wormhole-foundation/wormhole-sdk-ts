import {
  AccountAddress,
  Chain,
  ChainAddress,
  ChainId,
  ChainsConfig,
  Contracts,
  ErrNotWrapped,
  NativeAddress,
  Network,
  Platform,
  TokenAddress,
  TokenBridge,
  TokenId,
  UniversalAddress,
  UnsignedTransaction,
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
  AlgorandZeroAddress,
  AnyAlgorandAddress,
  TransactionSignerPair,
} from "@wormhole-foundation/connect-sdk-algorand";
import {
  ABIMethod,
  ABIType,
  Algodv2,
  OnApplicationComplete,
  SuggestedParams,
  bigIntToBytes,
  bytesToBigInt,
  decodeAddress,
  encodeAddress,
  getApplicationAddress,
  makeApplicationCallTxnFromObject,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
  modelsv2,
} from "algosdk";
import {
  assetOptinCheck,
  getIsWrappedAssetOnAlgorand,
  getOriginalAssetOffAlgorand,
  maybeOptInTx,
} from "./assets";
import { StorageLsig } from "./storage";
import { decodeLocalState, safeBigIntToNumber, checkBitsSet, getMessageFee } from "./utilities";
import { submitVAAHeader } from "./vaa";

import "@wormhole-foundation/connect-sdk-algorand-core";

export class AlgorandTokenBridge<N extends Network, C extends AlgorandChains>
  implements TokenBridge<N, AlgorandPlatformType, C>
{
  readonly chainId: ChainId;
  readonly coreAppId: bigint;
  readonly coreAppAddress: string;
  readonly tokenBridgeAppId: bigint;
  readonly tokenBridgeAddress: string;

  private constructor(
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
    const assetId = bytesToBigInt(new AlgorandAddress(token.toString()).toUint8Array());

    const isWrapped = await getIsWrappedAssetOnAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      assetId,
    );
    return isWrapped;
  }

  // Returns the original asset with its foreign chain
  async getOriginalAsset(token: TokenAddress<C>): Promise<TokenId> {
    if (!(await this.isWrappedAsset(token))) throw ErrNotWrapped(token.toString());

    const assetId = bytesToBigInt(new AlgorandAddress(token.toString()).toUint8Array());

    const whWrappedInfo = await getOriginalAssetOffAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      assetId,
    );
    const tokenId = {
      chain: toChain(whWrappedInfo.chainId),
      address: new UniversalAddress(whWrappedInfo.assetAddress),
    };
    return tokenId;
  }

  // Returns the address of the native version of this asset
  async getWrappedAsset(token: TokenId<Chain>): Promise<NativeAddress<C>> {
    const storageAccount = StorageLsig.forWrappedAsset(this.tokenBridgeAppId, token);
    const lsa = storageAccount.lsig();

    let asset: Uint8Array = await decodeLocalState(
      this.connection,
      this.tokenBridgeAppId,
      lsa.address(),
    );

    if (asset.length < 8) throw new Error("Invalid wrapped asset data");
    const nativeAddress = toNative(this.chain, asset.slice(0, 8));
    return nativeAddress;
  }

  // Checks if a wrapped version exists
  async hasWrappedAsset(token: TokenId<Chain>): Promise<boolean> {
    try {
      await this.getWrappedAsset(token);
      return true;
    } catch (e) {}
    return false;
  }

  async getWrappedNative(): Promise<NativeAddress<C>> {
    return toNative(this.chain, new AlgorandAddress(AlgorandZeroAddress).toString());
  }

  async isTransferCompleted(vaa: TokenBridge.TransferVAA): Promise<boolean> {
    const whm = {
      sequence: vaa.sequence,
      chain: vaa.emitterChain,
      emitter: vaa.emitterAddress,
    };
    const sl = StorageLsig.forMessageId(this.tokenBridgeAppId, whm);
    try {
      const isBitSet = await checkBitsSet(
        this.connection,
        this.tokenBridgeAppId,
        sl.lsig().address(),
        whm.sequence,
      );
      return isBitSet;
    } catch {
      return false;
    }
  }

  // Creates a Token Attestation VAA containing metadata about
  // the token that may be submitted to a Token Bridge on another chain
  // to allow it to create a wrapped version of the token
  async *createAttestation(
    token_to_attest: AnyAlgorandAddress,
    payer?: AnyAlgorandAddress,
  ): AsyncGenerator<UnsignedTransaction<N, C>> {
    if (!payer) throw new Error("Payer required to create attestation");

    const senderAddr = payer.toString();
    const assetId = bytesToBigInt(new AlgorandAddress(token_to_attest.toString()).toUint8Array());
    const txs: TransactionSignerPair[] = [];

    const tbs = StorageLsig.fromData({
      appId: this.coreAppId,
      appAddress: decodeAddress(this.coreAppAddress).publicKey,
      idx: BigInt(0),
      address: decodeAddress(this.tokenBridgeAddress).publicKey,
    });

    const { address: emitterAddr, txs: emitterOptInTxs } = await maybeOptInTx(
      this.connection,
      senderAddr,
      this.coreAppId,
      tbs,
    );
    txs.push(...emitterOptInTxs);

    let creatorAddr = "";
    let creatorAcctInfo;
    const attestSelector: Uint8Array = encoding.bytes.encode("attestToken");

    if (assetId !== BigInt(0)) {
      const assetInfoResp = await this.connection.getAssetByID(safeBigIntToNumber(assetId)).do();
      const assetInfo = modelsv2.Asset.from_obj_for_encoding(assetInfoResp);
      const creatorAcctInfoResp = await this.connection
        .accountInformation(assetInfo.params.creator)
        .do();
      creatorAcctInfo = modelsv2.Account.from_obj_for_encoding(creatorAcctInfoResp);
      if (creatorAcctInfo.authAddr === this.tokenBridgeAddress.toString()) {
        throw new Error("Cannot re-attest wormhole assets");
      }
    }

    const nativeStorageAcct = StorageLsig.forNativeAsset(this.tokenBridgeAppId, assetId);
    const txns = await maybeOptInTx(
      this.connection,
      senderAddr,
      this.tokenBridgeAppId,
      nativeStorageAcct,
    );
    creatorAddr = txns.address;
    txs.push(...txns.txs);

    const suggParams: SuggestedParams = await this.connection.getTransactionParams().do();

    const firstTxn = makeApplicationCallTxnFromObject({
      from: senderAddr,
      appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
      onComplete: OnApplicationComplete.NoOpOC,
      appArgs: [encoding.bytes.encode("nop")],
      suggestedParams: suggParams,
    });
    txs.push({ tx: firstTxn, signer: null });

    const mfee = await getMessageFee(this.connection, this.coreAppId);
    if (mfee > BigInt(0)) {
      const feeTxn = makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        suggestedParams: suggParams,
        to: this.tokenBridgeAddress,
        amount: mfee,
      });
      txs.push({ tx: feeTxn, signer: null });
    }

    let accts: string[] = [emitterAddr, creatorAddr, this.coreAppAddress];

    if (creatorAcctInfo) {
      accts.push(creatorAcctInfo.address);
    }

    let appTxn = makeApplicationCallTxnFromObject({
      appArgs: [attestSelector, bigIntToBytes(assetId, 8)],
      accounts: accts,
      appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
      foreignApps: [safeBigIntToNumber(this.coreAppId)],
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

    for (const utxn of txs) {
      yield this.createUnsignedTx(utxn, "TokenBridge.createAttestation", true);
    }
  }

  // Submits the Token Attestation VAA to the Token Bridge
  // to create the wrapped token represented by the data in the VAA
  async *submitAttestation(
    vaa: TokenBridge.AttestVAA,
    sender?: AnyAlgorandAddress,
    params?: SuggestedParams,
  ): AsyncGenerator<AlgorandUnsignedTransaction<N, C>> {
    if (!sender) throw new Error("Payer required to create attestation");
    if (!params) params = await this.connection.getTransactionParams().do();

    const senderAddr = sender.toString();

    const tokenStorage = StorageLsig.forWrappedAsset(this.tokenBridgeAppId, vaa.payload.token);
    const tokenStorageAddress = tokenStorage.lsig().address();

    const txs: TransactionSignerPair[] = [];

    let asset: Uint8Array = await decodeLocalState(
      this.connection,
      this.tokenBridgeAppId,
      tokenStorageAddress,
    );

    let foreignAssets: number[] = [];
    if (asset.length > 8) {
      const tmp = Buffer.from(asset.slice(0, 8));
      foreignAssets.push(safeBigIntToNumber(tmp.readBigUInt64BE(0)));
    }

    const noopSelector = encoding.bytes.encode("nop");
    txs.push({
      tx: makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        to: tokenStorageAddress,
        amount: 100000,
        suggestedParams: params,
      }),
    });
    let buf: Uint8Array = new Uint8Array(1);
    buf[0] = 0x01;
    txs.push({
      tx: makeApplicationCallTxnFromObject({
        appArgs: [noopSelector, buf],
        appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
        from: senderAddr,
        onComplete: OnApplicationComplete.NoOpOC,
        suggestedParams: params,
      }),
    });

    buf = new Uint8Array(1);
    buf[0] = 0x02;
    txs.push({
      tx: makeApplicationCallTxnFromObject({
        appArgs: [noopSelector, buf],
        appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
        from: senderAddr,
        onComplete: OnApplicationComplete.NoOpOC,
        suggestedParams: params,
      }),
    });
    const receiveAttestSelector = encoding.bytes.encode("receiveAttest");
    txs.push({
      tx: makeApplicationCallTxnFromObject({
        accounts: [], // TODO:
        appArgs: [receiveAttestSelector, serialize(vaa)],
        appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
        foreignAssets: foreignAssets,
        from: senderAddr,
        onComplete: OnApplicationComplete.NoOpOC,
        suggestedParams: params,
      }),
    });

    txs[txs.length - 1].tx.fee = txs[txs.length - 1].tx.fee * 2; // QUESTIONBW: There are like 3 different ways of adjusting fees in various functions--this should be standardized

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
    const assetId =
      token === "native" ? BigInt(0) : bytesToBigInt(new AlgorandAddress(token).toUint8Array());
    const qty = amount;
    const chain = recipient.chain;

    const receiver = recipient.address.toUniversalAddress();

    const fee = BigInt(0);

    const recipientChainId = toChainId(chain);

    const tbs = StorageLsig.fromData({
      appId: this.coreAppId,
      appAddress: decodeAddress(this.coreAppAddress).publicKey,
      idx: BigInt(0),
      address: decodeAddress(this.tokenBridgeAddress).publicKey,
    });

    const txs: TransactionSignerPair[] = [];
    const { address: emitterAddr, txs: emitterOptInTxs } = await maybeOptInTx(
      this.connection,
      senderAddr,
      this.coreAppId,
      tbs,
    );
    txs.push(...emitterOptInTxs);

    // Check that the auth address of the creator
    // is the token bridge
    let creator = "";
    let creatorAcct: modelsv2.Account | undefined;
    let wormhole: boolean = false;
    if (assetId !== BigInt(0)) {
      const assetInfoResp: Record<string, any> = await this.connection
        .getAssetByID(safeBigIntToNumber(assetId))
        .do();
      const asset = modelsv2.Asset.from_obj_for_encoding(assetInfoResp);
      creator = asset.params.creator;
      const creatorAcctInfoResp = await this.connection.accountInformation(creator).do();
      creatorAcct = modelsv2.Account.from_obj_for_encoding(creatorAcctInfoResp);
      wormhole = creatorAcct.authAddr === this.tokenBridgeAddress.toString();
    }

    const params: SuggestedParams = await this.connection.getTransactionParams().do();
    const msgFee: bigint = await getMessageFee(this.connection, this.coreAppId);
    if (msgFee > 0)
      txs.push({
        tx: makePaymentTxnWithSuggestedParamsFromObject({
          from: senderAddr,
          suggestedParams: params,
          to: this.tokenBridgeAddress,
          amount: msgFee,
        }),
        signer: null,
      });

    if (!wormhole) {
      const storage = StorageLsig.forNativeAsset(this.tokenBridgeAppId, assetId);
      const { address, txs } = await maybeOptInTx(
        this.connection,
        senderAddr,
        this.tokenBridgeAppId,
        storage,
      );
      creator = address;
      txs.push(...txs);
    }

    if (assetId !== BigInt(0) && !(await assetOptinCheck(this.connection, assetId, creator))) {
      // Looks like we need to optin
      const payTxn = makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        to: creator,
        amount: 100000,
        suggestedParams: params,
      });
      txs.push({ tx: payTxn, signer: null });
      // The tokenid app needs to do the optin since it has signature authority
      const bOptin: Uint8Array = encoding.bytes.encode("optin");
      let txn = makeApplicationCallTxnFromObject({
        from: senderAddr,
        appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
        onComplete: OnApplicationComplete.NoOpOC,
        appArgs: [bOptin, bigIntToBytes(assetId, 8)],
        foreignAssets: [safeBigIntToNumber(assetId)],
        accounts: [creator],
        suggestedParams: params,
      });
      txn.fee *= 2;
      txs.push({ tx: txn, signer: null });
    }

    const t = makeApplicationCallTxnFromObject({
      from: senderAddr,
      appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
      onComplete: OnApplicationComplete.NoOpOC,
      appArgs: [encoding.bytes.encode("nop")],
      suggestedParams: params,
    });
    txs.push({ tx: t, signer: null });

    let accounts: string[] = [];
    if (assetId === BigInt(0)) {
      const t = makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        to: creator,
        amount: qty,
        suggestedParams: params,
      });
      txs.push({ tx: t, signer: null });
      accounts = [emitterAddr, creator, creator];
    } else {
      const t = makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        to: creator,
        suggestedParams: params,
        amount: qty,
        assetIndex: safeBigIntToNumber(assetId),
      });
      txs.push({ tx: t, signer: null });

      accounts = creatorAcct?.address
        ? [emitterAddr, creator, creatorAcct.address]
        : [emitterAddr, creator];
    }

    const args = [
      encoding.bytes.encode("sendTransfer"),
      bigIntToBytes(assetId, 8),
      bigIntToBytes(qty, 8),
      receiver.toUint8Array(),
      bigIntToBytes(recipientChainId, 8),
      bigIntToBytes(fee, 8),
    ];

    if (payload) args.push(payload);

    const acTxn = makeApplicationCallTxnFromObject({
      from: senderAddr,
      appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
      onComplete: OnApplicationComplete.NoOpOC,
      appArgs: args,
      foreignApps: [safeBigIntToNumber(this.coreAppId)],
      foreignAssets: [safeBigIntToNumber(assetId)],
      accounts: accounts,
      suggestedParams: params,
    });
    acTxn.fee *= 2;
    txs.push({ tx: acTxn, signer: null });

    for (const utxn of txs) {
      yield this.createUnsignedTx(utxn, "TokenBridge.transfer", true);
    }
  }

  async *redeem(
    sender: AnyAlgorandAddress,
    vaa: TokenBridge.TransferVAA,
    unwrapNative: boolean = true,
    params?: SuggestedParams,
  ) {
    if (!params) params = await this.connection.getTransactionParams().do();

    const senderAddr = new AlgorandAddress(sender).toString();
    let { accounts, txs } = await submitVAAHeader(
      this.connection,
      this.coreAppId,
      this.tokenBridgeAppId,
      vaa,
      senderAddr,
    );

    const tokenStorage = StorageLsig.forWrappedAsset(this.tokenBridgeAppId, vaa.payload.token);
    const tokenStorageAddress = tokenStorage.lsig().address();

    let foreignAssets: number[] = [];
    let assetId: number = 0;
    if (vaa.payload.token.chain !== "Algorand") {
      let asset = await decodeLocalState(
        this.connection,
        this.tokenBridgeAppId,
        tokenStorageAddress,
      );
      if (asset.length > 8) {
        const tmp = Buffer.from(asset.slice(0, 8));
        assetId = safeBigIntToNumber(tmp.readBigUInt64BE(0));
      }
    } else {
      assetId = parseInt(vaa.payload.token.address.toString().slice(2), 16);
    }
    accounts.push(tokenStorageAddress);

    let aid = 0;
    let addr = "";
    if (vaa.payloadName === "TransferWithPayload") {
      aid = Number(bytesToBigInt(vaa.payload.to.address.toUint8Array()));
      addr = getApplicationAddress(aid);
    } else {
      addr = encodeAddress(vaa.payload.to.address.toUint8Array());
    }

    if (assetId !== 0) {
      foreignAssets.push(assetId);
      if (!(await assetOptinCheck(this.connection, BigInt(assetId), addr))) {
        if (senderAddr != addr) {
          throw new Error("cannot ASA optin for somebody else (asset " + assetId.toString() + ")");
        }

        txs.unshift({
          tx: makeAssetTransferTxnWithSuggestedParamsFromObject({
            amount: 0,
            assetIndex: assetId,
            from: senderAddr,
            suggestedParams: params,
            to: senderAddr,
          }),
          signer: null,
        });
      }
    }

    accounts.push(addr);
    txs.push({
      tx: makeApplicationCallTxnFromObject({
        accounts: accounts,
        appArgs: [encoding.bytes.encode("completeTransfer"), serialize(vaa)],
        appIndex: safeBigIntToNumber(this.tokenBridgeAppId),
        foreignAssets: foreignAssets,
        from: senderAddr,
        onComplete: OnApplicationComplete.NoOpOC,
        suggestedParams: params,
      }),
      signer: null,
    });

    // We need to cover the inner transactions
    if (vaa.payloadName === "Transfer" && vaa.payload.fee !== undefined && vaa.payload.fee === 0n) {
      txs[txs.length - 1].tx.fee = txs[txs.length - 1].tx.fee * 2;
    } else {
      txs[txs.length - 1].tx.fee = txs[txs.length - 1].tx.fee * 3;
    }

    if (vaa.payloadName === "TransferWithPayload") {
      txs[txs.length - 1].tx.appForeignApps = [aid];

      let m = ABIMethod.fromSignature("portal_transfer(byte[])byte[]");

      txs.push({
        tx: makeApplicationCallTxnFromObject({
          appArgs: [m.getSelector(), (m.args[0].type as ABIType).encode(serialize(vaa))],
          appIndex: aid,
          foreignAssets: foreignAssets,
          from: senderAddr,
          onComplete: OnApplicationComplete.NoOpOC,
          suggestedParams: params,
        }),
        signer: null,
      });
    }

    for (const utxn of txs) {
      yield this.createUnsignedTx(utxn, "TokenBridge.redeem", true);
    }
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
