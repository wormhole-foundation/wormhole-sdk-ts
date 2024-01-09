import {
  Chain,
  ChainToPlatform,
  Network,
  Platform,
  PlatformToChains,
  encoding,
  toChain as toChainName,
} from "@wormhole-foundation/sdk-base";
import {
  AttestationId,
  AttestationReceipt,
  AutomaticTokenBridge,
  ChainContext,
  Signer,
  TokenBridge,
  TokenId,
  TokenTransferDetails,
  TransactionId,
  TxHash,
  UnsignedTransaction,
  WormholeMessageId,
  deserialize,
  isTokenId,
  isTokenTransferDetails,
  isTransactionIdentifier,
  isWormholeMessageId,
  serialize,
  toNative,
  toUniversal,
} from "@wormhole-foundation/sdk-definitions";
import { signSendWait } from "../common";
import { DEFAULT_TASK_TIMEOUT } from "../config";
import { Wormhole } from "../wormhole";
import {
  AttestedTransferReceipt,
  CompletedTransferReceipt,
  SourceFinalizedTransferReceipt,
  SourceInitiatedTransferReceipt,
  TransferQuote,
  TransferReceipt,
  TransferState,
  WormholeTransfer,
  isAttested,
  isSourceFinalized,
  isSourceInitiated,
} from "../wormholeTransfer";

export type TokenTransferProtocol = "TokenBridge" | "AutomaticTokenBridge";
export type TokenTransferVAA = TokenBridge.TransferVAA | AutomaticTokenBridge.VAA;

export class TokenTransfer<N extends Network = Network>
  implements WormholeTransfer<TokenTransferProtocol>
{
  private readonly wh: Wormhole<N>;

  fromChain: ChainContext<N, Platform, Chain>;
  toChain: ChainContext<N, Platform, Chain>;

  // state machine tracker
  private _state: TransferState;

  // transfer details
  transfer: TokenTransferDetails;

  // txids, populated once transactions are submitted
  txids: TransactionId[] = [];

  // The corresponding vaa representing the TokenTransfer
  // on the source chain (if its been completed and finalized)
  attestations?: AttestationReceipt<TokenTransferProtocol>[];

  private constructor(
    wh: Wormhole<N>,
    transfer: TokenTransferDetails,
    fromChain?: ChainContext<N, Platform, Chain>,
    toChain?: ChainContext<N, Platform, Chain>,
  ) {
    this._state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;

    this.fromChain = fromChain ?? wh.getChain(transfer.from.chain);
    this.toChain = toChain ?? wh.getChain(transfer.to.chain);
  }

  getTransferState(): TransferState {
    return this._state;
  }

  // Static initializers for in flight transfers that have not been completed
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: TokenTransferDetails,
    timeout?: number,
    fromChain?: ChainContext<N, Platform, Chain>,
    toChain?: ChainContext<N, Platform, Chain>,
  ): Promise<TokenTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: WormholeMessageId,
    timeout?: number,
    fromChain?: ChainContext<N, Platform, Chain>,
    toChain?: ChainContext<N, Platform, Chain>,
  ): Promise<TokenTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: TransactionId,
    timeout?: number,
    fromChain?: ChainContext<N, Platform, Chain>,
    toChain?: ChainContext<N, Platform, Chain>,
  ): Promise<TokenTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: TokenTransferDetails | WormholeMessageId | TransactionId,
    timeout: number = 6000,
    fromChain?: ChainContext<N, Platform, Chain>,
    toChain?: ChainContext<N, Platform, Chain>,
  ): Promise<TokenTransfer<N>> {
    if (isTokenTransferDetails(from)) {
      fromChain = fromChain ?? wh.getChain(from.from.chain);
      toChain = toChain ?? wh.getChain(from.to.chain);

      // throws if invalid
      await TokenTransfer.validateTransferDetails(wh, from, fromChain, toChain);

      // Apply hackery
      from = {
        ...from,
        ...(await TokenTransfer.destinationOverrides(fromChain, toChain, from)),
      };

      return new TokenTransfer(wh, from, fromChain, toChain);
    }

    let tt: TokenTransfer<N>;
    if (isWormholeMessageId(from)) {
      tt = await TokenTransfer.fromIdentifier(wh, from, timeout);
    } else if (isTransactionIdentifier(from)) {
      tt = await TokenTransfer.fromTransaction(wh, from, timeout, fromChain);
    } else {
      throw new Error("Invalid `from` parameter for TokenTransfer");
    }

    tt.fromChain = fromChain ?? wh.getChain(tt.transfer.from.chain);
    tt.toChain = toChain ?? wh.getChain(tt.transfer.to.chain);

    await tt.fetchAttestation(timeout);
    return tt;
  }

  // init from the seq id
  private static async fromIdentifier<N extends Network>(
    wh: Wormhole<N>,
    id: WormholeMessageId,
    timeout?: number,
  ): Promise<TokenTransfer<N>> {
    const vaa = await TokenTransfer.getTransferVaa(wh, id, timeout);
    const automatic = vaa.protocolName === "AutomaticTokenBridge";

    // TODO: the `from.address` here is a lie, but we don't
    // immediately have enough info to get the _correct_ one
    let from = { chain: vaa.emitterChain, address: vaa.emitterAddress };
    let { token, to } = vaa.payload;

    const rescale = (amt: bigint, decimals: bigint) =>
      decimals > 8 ? amt * 10n ** (decimals - 8n) : amt;
    const amount = rescale(token.amount, await wh.getDecimals(token.chain, token.address));

    let nativeGasAmount: bigint = 0n;
    if (automatic) {
      nativeGasAmount = vaa.payload.payload.toNativeTokenAmount;
      from = { chain: vaa.emitterChain, address: vaa.payload.from };
      to = { chain: vaa.payload.to.chain, address: vaa.payload.payload.targetRecipient };
    }

    const details: TokenTransferDetails = {
      token: token,
      amount,
      from,
      to,
      automatic,
      nativeGas: nativeGasAmount,
    };

    // TODO: grab at least the init tx from the api
    const tt = new TokenTransfer(wh, details);
    tt.attestations = [{ id: id, attestation: vaa }];
    tt._state = TransferState.Attested;
    return tt;
  }

  private static async fromTransaction<N extends Network>(
    wh: Wormhole<N>,
    from: TransactionId,
    timeout: number,
    fromChain?: ChainContext<N, Platform, Chain>,
  ): Promise<TokenTransfer<N>> {
    fromChain = fromChain ?? wh.getChain(from.chain);
    const msg = await TokenTransfer.getTransferMessage(fromChain, from.txid, timeout);
    const tt = await TokenTransfer.fromIdentifier(wh, msg, timeout);
    tt.txids = [from];
    return tt;
  }

  // start the WormholeTransfer by submitting transactions to the source chain
  // returns a transaction hash
  async initiateTransfer(signer: Signer): Promise<TxHash[]> {
    if (this._state !== TransferState.Created)
      throw new Error("Invalid state transition in `initiateTransfer`");

    this.txids = await TokenTransfer.transfer<N>(this.fromChain, this.transfer, signer);
    this._state = TransferState.SourceInitiated;
    return this.txids.map(({ txid }) => txid);
  }

  // wait for the VAA to be ready
  // returns the sequence number
  async fetchAttestation(timeout?: number): Promise<AttestationId[]> {
    if (this._state < TransferState.SourceInitiated || this._state > TransferState.Attested)
      throw new Error(
        "Invalid state transition in `fetchAttestation`, expected at least `SourceInitiated`",
      );

    if (!this.attestations || this.attestations.length === 0) {
      if (this.txids.length === 0)
        throw new Error("No VAAs set and txids available to look them up");

      // TODO: assuming the _last_ transaction in the list will contain the msg id
      const txid = this.txids[this.txids.length - 1]!;
      const msgId = await TokenTransfer.getTransferMessage(this.fromChain, txid.txid, timeout);
      this.attestations = [{ id: msgId }];
    }

    for (const idx in this.attestations) {
      // Check if we already have the VAA
      if (this.attestations[idx]!.attestation) continue;

      this.attestations[idx]!.attestation = await TokenTransfer.getTransferVaa(
        this.wh,
        this.attestations[idx]!.id,
        timeout,
      );
    }
    this._state = TransferState.Attested;
    return this.attestations.map((vaa) => vaa.id);
  }

  // finish the WormholeTransfer by submitting transactions to the destination chain
  // returns a transaction hash
  async completeTransfer(signer: Signer): Promise<TxHash[]> {
    if (this._state < TransferState.Attested)
      throw new Error(
        "Invalid state transition, must be attested prior to calling `completeTransfer`.",
      );

    if (!this.attestations) throw new Error("No VAA details available");

    const { attestation } = this.attestations[0]!;
    if (!attestation) throw new Error(`No VAA found for ${this.attestations[0]!.id.sequence}`);

    const redeemTxids = await TokenTransfer.redeem<N>(
      this.toChain,
      attestation as TokenTransferVAA,
      signer,
    );
    this.txids.push(...redeemTxids);
    this._state = TransferState.DestinationInitiated;
    return redeemTxids.map(({ txid }) => txid);
  }

  // Static method to perform the transfer so a custom RPC may be used
  // Note: this assumes the transfer has already been validated with `validateTransfer`
  static async transfer<N extends Network>(
    fromChain: ChainContext<N, Platform, Chain>,
    transfer: TokenTransferDetails,
    signer: Signer<N, Chain>,
  ): Promise<TransactionId[]> {
    const senderAddress = toNative(signer.chain(), signer.address());

    const token = isTokenId(transfer.token) ? transfer.token.address : transfer.token;
    let xfer: AsyncGenerator<UnsignedTransaction<N>>;
    if (transfer.automatic) {
      const tb = await fromChain.getAutomaticTokenBridge();
      xfer = tb.transfer(senderAddress, transfer.to, token, transfer.amount, transfer.nativeGas);
    } else {
      const tb = await fromChain.getTokenBridge();
      xfer = tb.transfer(senderAddress, transfer.to, token, transfer.amount, transfer.payload);
    }

    return signSendWait<N, Chain>(fromChain, xfer, signer);
  }

  // Static method to allow passing a custom RPC
  static async redeem<N extends Network>(
    toChain: ChainContext<N, Platform, Chain>,
    vaa: TokenTransferVAA,
    signer: Signer<N, Chain>,
  ): Promise<TransactionId[]> {
    const signerAddress = toNative(signer.chain(), signer.address());

    const xfer =
      vaa.protocolName === "AutomaticTokenBridge"
        ? (await toChain.getAutomaticTokenBridge()).redeem(signerAddress, vaa)
        : (await toChain.getTokenBridge()).redeem(signerAddress, vaa);

    return signSendWait<N, Chain>(toChain, xfer, signer);
  }

  static async isTransferComplete<
    N extends Network,
    P extends Platform,
    C extends PlatformToChains<P>,
  >(toChain: ChainContext<N, P, C>, vaa: TokenTransferVAA): Promise<boolean> {
    // TODO: converter?
    if (vaa.protocolName === "AutomaticTokenBridge")
      vaa = deserialize("TokenBridge:TransferWithPayload", serialize(vaa));

    const tb = await toChain.getTokenBridge();
    return tb.isTransferCompleted(vaa);
  }

  static async getTransferMessage<
    N extends Network,
    P extends Platform,
    C extends PlatformToChains<P>,
  >(chain: ChainContext<N, P, C>, txid: TxHash, timeout?: number): Promise<WormholeMessageId> {
    // A Single wormhole message will be returned for a standard token transfer
    const whm = await Wormhole.parseMessageFromTx(chain, txid, timeout);
    if (whm.length !== 1) throw new Error("Expected a single Wormhole Message, got: " + whm.length);
    return whm[0]!;
  }

  static async getTransferVaa<N extends Network>(
    wh: Wormhole<N>,
    key: WormholeMessageId | TxHash,
    timeout?: number,
  ): Promise<TokenTransferVAA> {
    const vaa =
      typeof key === "string"
        ? await wh.getVaaByTxHash(key, TokenBridge.getTransferDiscriminator(), timeout)
        : await wh.getVaa(key, TokenBridge.getTransferDiscriminator(), timeout);

    if (!vaa) throw new Error(`No VAA available after retries exhausted`);

    // TODO: converter
    // Check if its automatic and re-de-serialize
    if (vaa.payloadName === "TransferWithPayload") {
      const { chain, address } = vaa.payload.to;
      const { tokenBridgeRelayer } = wh.config.chains[chain]!.contracts;
      const relayerAddress = tokenBridgeRelayer ? toUniversal(chain, tokenBridgeRelayer) : null;
      // If the target address is the relayer address, expect its an automatic token bridge vaa
      if (!!relayerAddress && address.equals(relayerAddress)) {
        return deserialize("AutomaticTokenBridge:TransferWithRelay", serialize(vaa));
      }
    }

    return vaa;
  }

  // Lookup the token id for the destination chain given the source chain
  // and token id
  static async lookupDestinationToken<N extends Network, SC extends Chain, DC extends Chain>(
    srcChain: ChainContext<N, ChainToPlatform<SC>, SC>,
    dstChain: ChainContext<N, ChainToPlatform<DC>, DC>,
    token: TokenId<SC> | "native",
  ): Promise<TokenId<DC>> {
    // that will be minted when the transfer is redeemed
    let lookup: TokenId;
    if (token === "native") {
      // if native, get the wrapped asset id
      lookup = await srcChain.getNativeWrappedTokenId();
    } else {
      try {
        const tb = await srcChain.getTokenBridge();
        // otherwise, check to see if it is a wrapped token locally
        lookup = await tb.getOriginalAsset(token.address);
      } catch (e) {
        // not a from-chain native wormhole-wrapped one
        lookup = token;
      }
    }

    // if the token id is actually native to the destination, return it
    if (lookup.chain === dstChain.chain) {
      return lookup as TokenId<DC>;
    }

    // otherwise, figure out what the token address representing the wormhole-wrapped token we're transferring
    const dstTb = await dstChain.getTokenBridge();
    const dstAddress = await dstTb.getWrappedAsset(lookup);
    return { chain: dstChain.chain, address: dstAddress };
  }

  static async validateTransferDetails<N extends Network>(
    wh: Wormhole<N>,
    transfer: TokenTransferDetails,
    fromChain?: ChainContext<N, Platform, Chain>,
    toChain?: ChainContext<N, Platform, Chain>,
  ): Promise<void> {
    if (transfer.from.chain === transfer.to.chain)
      throw new Error("Cannot transfer to the same chain");

    if (transfer.payload && transfer.automatic)
      throw new Error("Payload with automatic delivery is not supported");

    if (transfer.nativeGas && !transfer.automatic)
      throw new Error("Gas Dropoff is only supported for automatic transfers");

    fromChain = fromChain ?? wh.getChain(transfer.from.chain);
    toChain = toChain ?? wh.getChain(transfer.to.chain);

    if (!fromChain.supportsTokenBridge())
      throw new Error(`Token Bridge not supported on ${transfer.from.chain}`);

    if (!toChain.supportsTokenBridge())
      throw new Error(`Token Bridge not supported on ${transfer.to.chain}`);

    if (transfer.automatic && !fromChain.supportsAutomaticTokenBridge())
      throw new Error(`Automatic Token Bridge not supported on ${transfer.from.chain}`);

    if (transfer.amount === 0n) throw new Error("Amount cannot be 0");
  }

  static async quoteTransfer<N extends Network>(
    srcChain: ChainContext<N, Platform, Chain>,
    dstChain: ChainContext<N, Platform, Chain>,
    transfer: TokenTransferDetails,
  ): Promise<TransferQuote> {
    const dstToken = await this.lookupDestinationToken(srcChain, dstChain, transfer.token);
    const srcToken =
      transfer.token === "native" ? await srcChain.getNativeWrappedTokenId() : transfer.token;

    const dstDecimals = await dstChain.getDecimals(dstToken.address);
    const srcDecimals = await srcChain.getDecimals(srcToken.address);

    // truncate the amount for over-the-wire max representation
    const truncate = (amt: bigint, decimals: bigint) =>
      decimals > 8 ? amt / 10n ** (decimals - 8n) : amt;
    // scale by number of decimals, pair with truncate
    const scale = (amt: bigint, decimals: bigint) =>
      decimals > 8 ? amt * 10n ** (decimals - 8n) : amt;
    // dedust for source using the number of decimals on the source chain
    // but scale back to original decimals
    const dedust = (amt: bigint) => scale(truncate(amt, srcDecimals), srcDecimals);
    // truncate and rescale to fit destination token
    const mintable = (amt: bigint) => scale(truncate(amt, srcDecimals), dstDecimals);

    // dedust for transfer over the bridge which truncates to 8 decimals
    let srcAmount = dedust(transfer.amount);
    let dstAmount = mintable(transfer.amount);

    if (!transfer.automatic) {
      return {
        sourceToken: { token: srcToken, amount: srcAmount },
        destinationToken: { token: dstToken, amount: dstAmount },
      };
    }

    // Otherwise automatic

    // If a native gas dropoff is requested, remove that from the amount they'll get
    const _nativeGas = transfer.nativeGas ? mintable(transfer.nativeGas) : 0n;
    dstAmount -= _nativeGas;

    // The fee is also removed from the amount transferred
    // quoted on the source chain
    const stb = await srcChain.getAutomaticTokenBridge();
    const fee = await stb.getRelayerFee(transfer.from.address, transfer.to, srcToken.address);
    dstAmount -= mintable(fee);

    // The expected destination gas can be pulled from the destination token bridge
    let destinationNativeGas = 0n;
    if (transfer.nativeGas) {
      const dtb = await dstChain.getAutomaticTokenBridge();
      destinationNativeGas = await dtb.nativeTokenAmount(dstToken.address, _nativeGas);
    }

    return {
      sourceToken: {
        token: srcToken,
        amount: srcAmount,
      },
      destinationToken: { token: dstToken, amount: dstAmount },
      relayFee: { token: srcToken, amount: fee },
      destinationNativeGas,
    };
  }

  static async destinationOverrides<N extends Network>(
    srcChain: ChainContext<N, Platform, Chain>,
    dstChain: ChainContext<N, Platform, Chain>,
    transfer: TokenTransferDetails,
  ): Promise<TokenTransferDetails> {
    const _transfer = { ...transfer };

    // Bit of (temporary) hackery until solana contracts support being
    // sent a VAA with the primary address
    // Note: Do _not_ override if automatic or if the destination token is native
    // gas token
    if (transfer.to.chain === "Solana" && !_transfer.automatic) {
      const destinationToken = await TokenTransfer.lookupDestinationToken(
        srcChain,
        dstChain,
        _transfer.token,
      );
      // TODO: If the token is native, no need to overwrite the destination address check for native
      //if (!destinationToken.address.equals((await dstChain.getNativeWrappedTokenId()).address))
      _transfer.to = await dstChain.getTokenAccount(_transfer.to.address, destinationToken.address);
    }

    if (_transfer.to.chain === "Sei") {
      if (_transfer.to.chain === "Sei" && _transfer.payload)
        throw new Error("Arbitrary payloads unsupported for Sei");

      // For sei, we reserve the payload for a token transfer through the sei bridge.
      _transfer.payload = encoding.bytes.encode(
        JSON.stringify({
          basic_recipient: {
            recipient: encoding.b64.encode(_transfer.to.address.toString()),
          },
        }),
      );
      _transfer.to = Wormhole.chainAddress(
        _transfer.to.chain,
        dstChain.config.contracts!.translator!,
      );
    }

    return _transfer;
  }

  static getReceipt<N extends Network>(
    xfer: TokenTransfer<N>,
  ): TransferReceipt<TokenTransferProtocol> {
    const { transfer } = xfer;

    const protocol = transfer.automatic ? "AutomaticTokenBridge" : "TokenBridge";
    const from = transfer.from.chain;
    const to = transfer.to.chain;

    let receipt: TransferReceipt<TokenTransferProtocol> = {
      protocol,
      request: transfer,
      from: from,
      to: to,
      state: TransferState.Created,
    };

    const originTxs = xfer.txids.filter((txid) => txid.chain === transfer.from.chain);
    if (originTxs.length > 0) {
      receipt = {
        ...receipt,
        state: TransferState.SourceInitiated,
        originTxs: originTxs,
      } satisfies SourceInitiatedTransferReceipt<TokenTransferProtocol>;
    }

    const att =
      xfer.attestations && xfer.attestations.length > 0 ? xfer.attestations![0]! : undefined;
    const attestation = att && att.id ? { id: att.id, attestation: att.attestation } : undefined;
    if (attestation) {
      if (attestation.id) {
        receipt = {
          ...(receipt as SourceInitiatedTransferReceipt<TokenTransferProtocol>),
          state: TransferState.SourceFinalized,
          attestation: { id: attestation.id },
        } satisfies SourceFinalizedTransferReceipt<TokenTransferProtocol>;

        if (attestation.attestation) {
          receipt = {
            ...receipt,
            state: TransferState.Attested,
            attestation: { id: attestation.id, attestation: attestation.attestation },
          } satisfies AttestedTransferReceipt<TokenTransferProtocol>;
        }
      }
    }

    const destinationTxs = xfer.txids.filter((txid) => txid.chain === transfer.to.chain);
    if (destinationTxs.length > 0) {
      receipt = {
        ...(receipt as AttestedTransferReceipt<TokenTransferProtocol>),
        state: TransferState.DestinationInitiated,
        destinationTxs: destinationTxs,
      } satisfies CompletedTransferReceipt<TokenTransferProtocol>;
    }

    return receipt;
  }

  // AsyncGenerator fn that produces status updates through an async generator
  // eventually producing a receipt
  // can be called repeatedly so the receipt is updated as it moves through the
  // steps of the transfer
  static async *track<N extends Network, SC extends Chain, DC extends Chain>(
    wh: Wormhole<N>,
    receipt: TransferReceipt<TokenTransferProtocol, SC, DC>,
    timeout: number = DEFAULT_TASK_TIMEOUT,
    fromChain?: ChainContext<N, ChainToPlatform<SC>, SC>,
    toChain?: ChainContext<N, ChainToPlatform<DC>, DC>,
  ) {
    const start = Date.now();
    const leftover = (start: number, max: number) => Math.max(max - (Date.now() - start), 0);

    fromChain = fromChain ?? wh.getChain(receipt.from);
    toChain = toChain ?? wh.getChain(receipt.to);

    // Check the source chain for initiation transaction
    // and capture the message id
    if (isSourceInitiated(receipt)) {
      if (receipt.originTxs.length === 0) throw "Origin transactions required to fetch message id";
      const { txid } = receipt.originTxs[receipt.originTxs.length - 1]!;
      const msg = await TokenTransfer.getTransferMessage(fromChain, txid, leftover(start, timeout));
      receipt = {
        ...receipt,
        state: TransferState.SourceFinalized,
        attestation: { id: msg },
      } satisfies SourceFinalizedTransferReceipt<TokenTransferProtocol>;
      yield receipt;
    }

    // If the source is finalized, we need to fetch the signed attestation
    // so that we may deliver it to the destination chain
    // or at least track the transfer through its progress
    if (isSourceFinalized(receipt)) {
      if (!receipt.attestation.id) throw "Attestation id required to fetch attestation";
      const { id } = receipt.attestation;
      const attestation = await TokenTransfer.getTransferVaa(wh, id, leftover(start, timeout));
      receipt = {
        ...receipt,
        attestation: { id, attestation },
        state: TransferState.Attested,
      } satisfies AttestedTransferReceipt<TokenTransferProtocol>;
      yield receipt;
    }

    // First try to grab the tx status from the API
    // Note: this requires a subsequent async step on the backend
    // to have the dest txid populated, so it may be delayed by some time
    if (isAttested(receipt) || isSourceFinalized(receipt)) {
      if (!receipt.attestation.id) throw "Attestation id required to fetch redeem tx";
      const { id } = receipt.attestation;
      const txStatus = await wh.getTransactionStatus(id, leftover(start, timeout));
      if (txStatus && txStatus.globalTx?.destinationTx?.txHash) {
        const { chainId, txHash } = txStatus.globalTx.destinationTx;
        receipt = {
          ...receipt,
          destinationTxs: [{ chain: toChainName(chainId) as DC, txid: txHash }],
          state: TransferState.DestinationFinalized,
        } satisfies CompletedTransferReceipt<TokenTransferProtocol>;
      }
      yield receipt;
    }

    // Fall back to asking the destination chain if this VAA has been redeemed
    // Note: We do not get any destinationTxs with this method
    if (isAttested(receipt)) {
      if (!receipt.attestation.attestation) throw "Signed Attestation required to check for redeem";

      let isComplete = await TokenTransfer.isTransferComplete(
        toChain,
        receipt.attestation.attestation as TokenTransferVAA,
      );

      if (isComplete) {
        receipt = {
          ...receipt,
          state: TransferState.DestinationFinalized,
        } satisfies CompletedTransferReceipt<TokenTransferProtocol>;
      }

      yield receipt;
    }

    yield receipt;
  }
}
