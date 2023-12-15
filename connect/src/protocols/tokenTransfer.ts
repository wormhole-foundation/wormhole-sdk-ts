import { Chain, Network, PlatformToChains, encoding } from "@wormhole-foundation/sdk-base";
import { Platform } from "@wormhole-foundation/sdk-base/dist/cjs";
import {
  ChainContext,
  Signer,
  TokenAddress,
  TokenBridge,
  TokenId,
  TransactionId,
  TxHash,
  UniversalAddress,
  UnsignedTransaction,
  WormholeMessageId,
  isTransactionIdentifier,
  isWormholeMessageId,
  nativeChainAddress,
  toNative,
} from "@wormhole-foundation/sdk-definitions";
import { signSendWait } from "../common";
import { TokenTransferDetails, isTokenTransferDetails } from "../types";
import { Wormhole } from "../wormhole";
import { AttestationId, TransferQuote, TransferState, WormholeTransfer } from "../wormholeTransfer";

export class TokenTransfer<N extends Network> implements WormholeTransfer {
  private readonly wh: Wormhole<N>;

  // state machine tracker
  private _state: TransferState;

  // transfer details
  transfer: TokenTransferDetails;

  // txids, populated once transactions are submitted
  txids: TransactionId[] = [];

  // The corresponding vaa representing the TokenTransfer
  // on the source chain (if its been completed and finalized)
  vaas?: {
    id: WormholeMessageId;
    vaa?: TokenBridge.VAA<"Transfer" | "TransferWithPayload">;
  }[];

  private constructor(wh: Wormhole<N>, transfer: TokenTransferDetails) {
    this._state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;
  }

  getTransferState(): TransferState {
    return this._state;
  }

  // Static initializers for in flight transfers that have not been completed
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: TokenTransferDetails,
  ): Promise<TokenTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: WormholeMessageId,
    timeout?: number,
  ): Promise<TokenTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: TransactionId,
    timeout?: number,
  ): Promise<TokenTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: TokenTransferDetails | WormholeMessageId | TransactionId,
    timeout: number = 6000,
  ): Promise<TokenTransfer<N>> {
    if (isTokenTransferDetails(from)) {
      await TokenTransfer.validateTransferDetails(wh, from);
      const fromChain = wh.getChain(from.from.chain);
      const toChain = wh.getChain(from.to.chain);

      // Apply hackery
      from = {
        ...from,
        ...(await TokenTransfer.destinationOverrides(fromChain, toChain, from)),
      };

      return new TokenTransfer(wh, from);
    }

    let tt: TokenTransfer<N>;
    if (isWormholeMessageId(from)) {
      tt = await TokenTransfer.fromIdentifier(wh, from, timeout);
    } else if (isTransactionIdentifier(from)) {
      tt = await TokenTransfer.fromTransaction(wh, from, timeout);
    } else {
      throw new Error("Invalid `from` parameter for TokenTransfer");
    }
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

    // Check if its a payload 3 targeted at a relayer on the destination chain
    const automatic = TokenTransfer.isAutomatic(wh, vaa);

    // TODO: the `from.address` here is a lie, but we don't
    // immediately have enough info to get the _correct_ one
    // TODO: grab at least the init tx from the api
    const from = { chain: vaa.emitterChain, address: vaa.emitterAddress };

    let { token, to } = vaa.payload;

    const { address, chain } = token;
    const decimals = await wh.getDecimals(token.chain, token.address);
    const rescale = (amt: bigint, decimals: bigint) => amt * 10n ** (decimals - 8n);

    const _amount = rescale(token.amount, decimals);

    let nativeGasAmount: bigint = 0n;
    if (automatic) {
      const relayerPayload = (vaa as TokenBridge.VAA<"TransferWithPayload">).payload.payload;
      // TODO: how do we not have a payload for this yet
      // const type = relayerPayload.slice(0, 1);
      // const fee = rescale(encoding.bignum.decode(relayerPayload.slice(1, 33)), decimals);

      // Scale gas to account for truncated VAA amount
      nativeGasAmount = rescale(encoding.bignum.decode(relayerPayload.slice(33, 65)), decimals);
      // actual receiver
      const receiver = new UniversalAddress(relayerPayload.slice(65, 97));
      // Overwrite the receiver
      to = { chain: vaa.payload.to.chain, address: receiver };
    }

    const details: TokenTransferDetails = {
      token: { address, chain },
      amount: _amount,
      from,
      to,
      automatic,
      nativeGas: nativeGasAmount,
    };

    const tt = new TokenTransfer(wh, details);
    tt.vaas = [{ id, vaa }];
    tt._state = TransferState.Attested;
    return tt;
  }

  private static async fromTransaction<N extends Network>(
    wh: Wormhole<N>,
    from: TransactionId,
    timeout: number,
  ): Promise<TokenTransfer<N>> {
    const msg = await TokenTransfer.getTransferMessage(wh.getChain(from.chain), from.txid, timeout);
    const tt = await TokenTransfer.fromIdentifier(wh, msg, timeout);
    tt.txids = [from];
    return tt;
  }

  // start the WormholeTransfer by submitting transactions to the source chain
  // returns a transaction hash
  async initiateTransfer(signer: Signer): Promise<TxHash[]> {
    /*
        0) check that the current `state` is valid to call this (eg: state == Created)
        1) get a token transfer transaction for the token bridge given the context
        2) sign it given the signer
        3) submit it to chain
        4) return transaction id
    */

    if (this._state !== TransferState.Created)
      throw new Error("Invalid state transition in `start`");

    const fromChain = this.wh.getChain(this.transfer.from.chain);
    this.txids = await TokenTransfer.transfer<N>(fromChain, this.transfer, signer);
    this._state = TransferState.SourceInitiated;

    return this.txids.map(({ txid }) => txid);
  }

  // wait for the VAA to be ready
  // returns the sequence number
  async fetchAttestation(timeout?: number): Promise<AttestationId[]> {
    /*
        0) check that the current `state` is valid to call this  (eg: state == Started)
        1) poll the api on an interval to check if the VAA is available
        2) Once available, pull the VAA and parse it
        3) return seq
    */
    if (this._state < TransferState.SourceInitiated || this._state > TransferState.Attested)
      throw new Error("Invalid state transition in `ready`");

    if (!this.vaas || this.vaas.length === 0) {
      if (this.txids.length === 0)
        throw new Error("No VAAs set and txids available to look them up");

      // TODO: assuming the _last_ transaction in the list will contain the msg id
      const txid = this.txids[this.txids.length - 1]!;
      const msgId = await TokenTransfer.getTransferMessage(
        this.wh.getChain(txid.chain),
        txid.txid,
        timeout,
      );
      this.vaas = [{ id: msgId }];
    }

    for (const idx in this.vaas) {
      // Check if we already have the VAA
      if (this.vaas[idx]!.vaa) continue;

      this.vaas[idx]!.vaa = await TokenTransfer.getTransferVaa(
        this.wh,
        this.vaas[idx]!.id,
        timeout,
      );
    }

    this._state = TransferState.Attested;
    return this.vaas.map((v) => v.id);
  }

  // finish the WormholeTransfer by submitting transactions to the destination chain
  // returns a transaction hash
  async completeTransfer(signer: Signer): Promise<TxHash[]> {
    /*
        0) check that the current `state` is valid to call this  (eg: state == Ready)
        1) prepare the transactions and sign them given the signer
        2) submit the VAA and transactions on chain
        3) return txid of submission
    */
    if (this._state < TransferState.Attested)
      throw new Error("Invalid state transition in `finish`. Be sure to call `fetchAttestation`.");

    if (!this.vaas) throw new Error("No VAA details available");

    // TODO: when do we get >1?
    const { vaa } = this.vaas[0]!;
    if (!vaa) throw new Error(`No VAA found for ${this.vaas[0]!.id.sequence}`);

    const toChain = this.wh.getChain(this.transfer.to.chain);
    const redeemTxids = await TokenTransfer.redeem<N>(
      toChain,
      vaa,
      signer,
      this.transfer.automatic,
    );

    this.txids.push(...redeemTxids);
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

    const token =
      transfer.token === "native"
        ? "native"
        : (transfer.token.address as TokenAddress<typeof fromChain.chain>);

    let xfer: AsyncGenerator<UnsignedTransaction<N>>;
    if (transfer.automatic) {
      const tb = await fromChain.getAutomaticTokenBridge();
      xfer = tb.transfer(senderAddress, transfer.to, token, transfer.amount, transfer.nativeGas);
    } else {
      const tb = await fromChain.getTokenBridge();
      xfer = tb.transfer(senderAddress, transfer.to, token, transfer.amount, transfer.payload);
    }

    return signSendWait<N, typeof fromChain.chain>(fromChain, xfer, signer);
  }

  // Static method to allow passing a custom RPC
  static async redeem<N extends Network>(
    toChain: ChainContext<N, Platform, Chain>,
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
    signer: Signer<N, Chain>,
    automatic?: boolean,
  ): Promise<TransactionId[]> {
    const signerAddress = toNative(signer.chain(), signer.address());

    let xfer: AsyncGenerator<UnsignedTransaction<N, Chain>>;
    if (automatic) {
      if (vaa.payloadName === "Transfer")
        throw new Error("VAA is a simple transfer but expected Payload for automatic delivery");

      const tb = await toChain.getAutomaticTokenBridge();
      xfer = tb.redeem(signerAddress, vaa);
    } else {
      const tb = await toChain.getTokenBridge();
      xfer = tb.redeem(signerAddress, vaa);
    }

    return signSendWait<N, Chain>(toChain, xfer, signer);
  }

  static async isTransferComplete<
    N extends Network,
    P extends Platform,
    C extends PlatformToChains<P>,
  >(
    toChain: ChainContext<N, P, C>,
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
  ): Promise<boolean> {
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
  ): Promise<TokenBridge.VAA<"Transfer" | "TransferWithPayload">> {
    const vaa =
      typeof key === "string"
        ? await wh.getVaaByTxHash(key, TokenBridge.getTransferDiscriminator(), timeout)
        : await wh.getVaa(key, TokenBridge.getTransferDiscriminator(), timeout);

    if (!vaa) throw new Error(`No VAA available after retries exhausted`);
    return vaa;
  }

  static async lookupDestinationToken<N extends Network>(
    srcChain: ChainContext<N, Platform, Chain>,
    dstChain: ChainContext<N, Platform, Chain>,
    transfer: TokenTransferDetails,
  ): Promise<TokenId> {
    // make sure we are passed the correct params
    if (srcChain.chain !== transfer.from.chain || dstChain.chain !== transfer.to.chain)
      throw "Invalid parameters passed to lookup destination token";

    // that will be minted when the transfer is redeemed
    let lookup: TokenId;
    if (transfer.token === "native") {
      // if native, get the wrapped asset id
      lookup = await srcChain.getNativeWrappedTokenId();
    } else {
      try {
        const tb = await srcChain.getTokenBridge();
        // otherwise, check to see if it is a wrapped token locally
        lookup = await tb.getOriginalAsset(transfer.token.address);
      } catch {
        // not a from-chain native wormhole-wrapped one
        lookup = transfer.token;
      }
    }

    // if the token id is actually native to the destination, return it
    if (lookup.chain === transfer.to.chain) {
      return lookup;
    }

    // otherwise, figure out what the token address representing the wormhole-wrapped token we're transferring
    const dstTb = await dstChain.getTokenBridge();
    const dstAddress = await dstTb.getWrappedAsset(lookup);
    return { chain: transfer.to.chain, address: dstAddress };
  }

  static isAutomatic<N extends Network>(
    wh: Wormhole<N>,
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
  ) {
    // Check if its a payload 3 targeted at a relayer on the destination chain
    const { chain, address } = vaa.payload.to;
    const { tokenBridgeRelayer } = wh.config.chains[chain]!.contracts;

    const relayerAddress = tokenBridgeRelayer
      ? nativeChainAddress(chain, tokenBridgeRelayer).address.toUniversalAddress()
      : null;

    return (
      vaa.payloadName === "TransferWithPayload" &&
      !!relayerAddress &&
      address.equals(relayerAddress)
    );
  }

  static async validateTransferDetails<N extends Network>(
    wh: Wormhole<N>,
    transfer: TokenTransferDetails,
  ): Promise<void> {
    if (transfer.payload && transfer.automatic)
      throw new Error("Payload with automatic delivery is not supported");

    if (transfer.nativeGas && !transfer.automatic)
      throw new Error("Gas Dropoff is only supported for automatic transfers");

    const fromChain = wh.getChain(transfer.from.chain);
    const toChain = wh.getChain(transfer.to.chain);

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
    const dstToken = await this.lookupDestinationToken(srcChain, dstChain, transfer);
    const srcToken =
      transfer.token === "native" ? await srcChain.getNativeWrappedTokenId() : transfer.token;

    const dstDecimals = await dstChain.getDecimals(dstToken.address);
    const srcDecimals = await srcChain.getDecimals(srcToken.address);

    // truncate the amount for over-the-wire max representation
    const truncate = (amt: bigint, decimals: bigint) => amt / 10n ** (decimals - 8n);
    // scale by number of decimals, pair with truncate
    const scale = (amt: bigint, decimals: bigint) => amt * 10n ** (decimals - 8n);
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
        _transfer,
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
      _transfer.to = nativeChainAddress(_transfer.to.chain, dstChain.config.contracts!.translator!);
    }

    return _transfer;
  }
}
