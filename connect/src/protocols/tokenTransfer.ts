import { Network, PlatformToChains, encoding } from "@wormhole-foundation/sdk-base";
import { Platform } from "@wormhole-foundation/sdk-base/dist/cjs";
import {
  ChainContext,
  Signer,
  TokenAddress,
  TokenBridge,
  TokenId,
  TransactionId,
  TxHash,
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
import { AttestationId, TransferState, WormholeTransfer } from "../wormholeTransfer";

export class TokenTransfer<N extends Network> implements WormholeTransfer {
  private readonly wh: Wormhole<N>;

  // state machine tracker
  private state: TransferState;

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
    this.state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;
  }

  async getTransferState(): Promise<TransferState> {
    if (!this.transfer.automatic) return this.state;
    if (!this.vaas || this.vaas.length === 0) return this.state;

    const txStatus = await this.wh.getTransactionStatus(this.vaas[0]!.id);
    if (txStatus && txStatus.globalTx.destinationTx) {
      switch (txStatus.globalTx.destinationTx.status) {
        case "completed":
          this.state = TransferState.Completed;
          break;
        // ... more?
      }
    }

    return this.state;
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

      // Apply hackery
      from = { ...from, ...(await TokenTransfer.destinationOverrides(wh, from)) };

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

    const { token, to } = vaa.payload;
    const details: TokenTransferDetails = {
      amount: token.amount,
      token,
      from,
      to,
      automatic,
    };

    const tt = new TokenTransfer(wh, details);
    tt.vaas = [{ id, vaa }];
    tt.state = TransferState.Attested;
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

    if (this.state !== TransferState.Created)
      throw new Error("Invalid state transition in `start`");

    const fromChain = this.wh.getChain(this.transfer.from.chain);
    this.txids = await TokenTransfer.transfer(fromChain, this.transfer, signer);
    this.state = TransferState.Initiated;
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
    if (this.state < TransferState.Initiated || this.state > TransferState.Attested)
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

    this.state = TransferState.Attested;
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
    if (this.state < TransferState.Attested)
      throw new Error("Invalid state transition in `finish`. Be sure to call `fetchAttestation`.");

    if (!this.vaas) throw new Error("No VAA details available");

    // TODO: when do we get >1?
    const { vaa } = this.vaas[0]!;
    if (!vaa) throw new Error(`No VAA found for ${this.vaas[0]!.id.sequence}`);

    const toChain = this.wh.getChain(this.transfer.to.chain);
    const redeemTxids = await TokenTransfer.redeem(toChain, vaa, signer, this.transfer.automatic);

    this.txids.push(...redeemTxids);
    return redeemTxids.map(({ txid }) => txid);
  }

  // Static method to perform the transfer so a custom RPC may be used
  // Note: this assumes the transfer has already been validated with `validateTransfer`
  static async transfer<N extends Network, P extends Platform, C extends PlatformToChains<P>>(
    fromChain: ChainContext<N, P, C>,
    transfer: TokenTransferDetails,
    signer: Signer<N, C>,
  ): Promise<TransactionId[]> {
    const senderAddress = toNative(signer.chain(), signer.address());

    const token =
      transfer.token === "native" ? "native" : (transfer.token.address as TokenAddress<C>);

    let xfer: AsyncGenerator<UnsignedTransaction<N, C>>;
    if (transfer.automatic) {
      const tb = await fromChain.getAutomaticTokenBridge();
      xfer = tb.transfer(senderAddress, transfer.to, token, transfer.amount, transfer.nativeGas);
    } else {
      const tb = await fromChain.getTokenBridge();
      xfer = tb.transfer(senderAddress, transfer.to, token, transfer.amount, transfer.payload);
    }

    return signSendWait<N, C>(fromChain, xfer, signer);
  }

  // Static method to allow passing a custom RPC
  static async redeem<N extends Network, P extends Platform, C extends PlatformToChains<P>>(
    toChain: ChainContext<N, P, C>,
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
    signer: Signer<N, C>,
    automatic?: boolean,
  ): Promise<TransactionId[]> {
    const signerAddress = toNative(signer.chain(), signer.address());

    let xfer: AsyncGenerator<UnsignedTransaction<N, C>>;
    if (automatic) {
      if (vaa.payloadName === "Transfer")
        throw new Error("VAA is a simple transfer but expected Payload for automatic delivery");

      const tb = await toChain.getAutomaticTokenBridge();
      xfer = tb.redeem(signerAddress, vaa);
    } else {
      const tb = await toChain.getTokenBridge();
      xfer = tb.redeem(signerAddress, vaa);
    }

    return signSendWait<N, C>(toChain, xfer, signer);
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
    wh: Wormhole<N>,
    transfer: TokenTransferDetails,
  ): Promise<TokenId> {
    // that will be minted when the transfer is redeemed
    let lookup: TokenId;
    if (transfer.token === "native") {
      // if native, get the wrapped asset id
      lookup = await wh.getChain(transfer.from.chain).getNativeWrappedTokenId();
    } else {
      try {
        // otherwise, check to see if it is a wrapped token locally
        lookup = await wh.getOriginalAsset(transfer.token);
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
    return await wh.getWrappedAsset(transfer.to.chain, lookup);
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

  static async destinationOverrides<N extends Network>(
    wh: Wormhole<N>,
    _transfer: TokenTransferDetails,
  ): Promise<TokenTransferDetails> {
    const transfer = { ..._transfer };

    // Bit of (temporary) hackery until solana contracts support being
    // sent a VAA with the primary address
    // Do _not_ override if automatic
    if (transfer.to.chain === "Solana" && !transfer.automatic) {
      // TODO: check for native
      const destinationToken = await TokenTransfer.lookupDestinationToken(wh, transfer);
      transfer.to = await wh.getTokenAccount(transfer.to, destinationToken);
    }

    if (transfer.to.chain === "Sei") {
      if (transfer.to.chain === "Sei" && transfer.payload)
        throw new Error("Arbitrary payloads unsupported for Sei");

      // For sei, we reserve the payload for a token transfer through the sei bridge.
      transfer.payload = encoding.bytes.encode(
        JSON.stringify({
          basic_recipient: {
            recipient: encoding.b64.encode(transfer.to.address.toString()),
          },
        }),
      );

      transfer.to = nativeChainAddress(transfer.to.chain, wh.getContracts("Sei")!.translator!);
    }

    return transfer;
  }
}
