import {
  ChainName,
  PlatformName,
  chainToPlatform,
  toChainName,
} from '@wormhole-foundation/sdk-base';
import {
  ChainAddress,
  ChainContext,
  GatewayTransferDetails,
  IBCTransferInfo,
  NativeAddress,
  Signer,
  TokenId,
  TransactionId,
  TxHash,
  UniversalAddress,
  UnsignedTransaction,
  VAA,
  WormholeMessageId,
  deserialize,
  asGatewayMsg,
  isGatewayTransferDetails,
  isTransactionIdentifier,
  isWormholeMessageId,
  toNative,
  gatewayTransferMsg,
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
} from '@wormhole-foundation/sdk-definitions';
import { Wormhole } from '../wormhole';
import {
  AttestationId,
  TransferState,
  WormholeTransfer,
} from '../wormholeTransfer';

export class GatewayTransfer implements WormholeTransfer {
  static chain: ChainName = 'Wormchain';

  private readonly wh: Wormhole;

  private readonly wc: ChainContext<PlatformName>;
  private readonly gatewayAddress: ChainAddress;

  // state machine tracker
  private state: TransferState;

  // Initial Transfer Settings
  transfer: GatewayTransferDetails;

  // Transaction Ids from source chain
  transactions: TransactionId[] = [];

  // The corresponding vaa representing the GatewayTransfer
  // on the source chain (if it came from outside cosmos and if its been completed and finalized)
  vaas?: {
    id: WormholeMessageId;
    vaa?: VAA<'TransferWithPayload'> | VAA<'Transfer'>;
  }[];

  // Any transfers we do over ibc
  ibcTransfers?: IBCTransferInfo[];

  private constructor(wh: Wormhole, transfer: GatewayTransferDetails) {
    this.state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;

    // reference from conf instead of asking the module
    // so we can prevent weird imports
    this.gatewayAddress = {
      chain: GatewayTransfer.chain,
      address: toNative(
        GatewayTransfer.chain,
        this.wh.conf.chains[GatewayTransfer.chain]!.contracts.gateway!,
      ),
    };

    // cache the wormchain chain context since we need it for checks
    this.wc = this.wh.getChain(GatewayTransfer.chain);
  }

  async getTransferState(): Promise<TransferState> {
    return this.state;
  }

  // Static initializers for in flight transfers that have not been completed
  static async from(
    wh: Wormhole,
    from: GatewayTransferDetails,
  ): Promise<GatewayTransfer>;
  static async from(
    wh: Wormhole,
    from: WormholeMessageId,
  ): Promise<GatewayTransfer>;
  static async from(
    wh: Wormhole,
    from: TransactionId,
  ): Promise<GatewayTransfer>;
  static async from(
    wh: Wormhole,
    from: GatewayTransferDetails | WormholeMessageId | TransactionId,
  ): Promise<GatewayTransfer> {
    // Fresh new transfer
    if (isGatewayTransferDetails(from)) {
      return new GatewayTransfer(wh, from);
    }

    // Picking up where we left off
    let gtd: GatewayTransferDetails;
    let txns: TransactionId[] = [];
    if (isTransactionIdentifier(from)) {
      txns.push(from);
      gtd = await GatewayTransfer._fromTransaction(wh, from);
    } else if (isWormholeMessageId(from)) {
      // TODO: we're missing the transaction that created this
      gtd = await GatewayTransfer._fromMsgId(wh, from);
    } else {
      throw new Error('Invalid `from` parameter for GatewayTransfer');
    }

    const gt = new GatewayTransfer(wh, gtd);
    gt.transactions = txns;

    // Since we're picking up from somewhere we can move the
    // state maching to initiated
    gt.state = TransferState.Initiated;

    // Wait for what _can_ complete to complete
    await gt.fetchAttestation();

    return gt;
  }

  // Recover Transfer info from VAA details
  private static async _fromMsgId(
    wh: Wormhole,
    from: WormholeMessageId,
  ): Promise<GatewayTransferDetails> {
    // Starting with the VAA
    const { chain: emitterChain, emitter, sequence } = from;
    const vaa = await GatewayTransfer.getTransferVaa(
      wh,
      emitterChain,
      emitter,
      sequence,
    );

    // The VAA may have a payload which may have a nested GatewayTransferMessage
    let payload: Uint8Array | undefined =
      vaa.payloadLiteral === 'TransferWithPayload'
        ? vaa.payload.payload
        : undefined;

    // Nonce for GatewayTransferMessage may be in the payload
    // and since we use the payload to find the Wormchain transacton
    // we need to preserve it
    let nonce: number | undefined;

    let to = { ...vaa.payload.to };
    // The payload here may be the message for Gateway
    // Lets be sure to pull the real payload if its set
    // Otherwise revert to undefined
    if (payload) {
      try {
        const maybeWithPayload = asGatewayMsg(Buffer.from(payload).toString());
        nonce = maybeWithPayload.nonce;
        payload = maybeWithPayload.payload
          ? new Uint8Array(Buffer.from(maybeWithPayload.payload))
          : undefined;

        const destChain = toChainName(maybeWithPayload.chain);
        const recipientAddress = Buffer.from(
          maybeWithPayload.recipient,
          'base64',
        ).toString();

        to = {
          chain: destChain,
          // @ts-ignore
          address: toNative(destChain, recipientAddress),
        };
      } catch (e) {
        // Ignoring, throws if not the payload isnt JSON
      }
    }

    const { chain, address, amount } = vaa.payload.token;

    // Reconstruct the details
    const details: GatewayTransferDetails = {
      token: { chain, address },
      amount: amount,
      // TODO: the `from.address` here is a lie, but we don't
      // immediately have enough info to get the _correct_ one
      from: { chain: from.chain, address: from.emitter },
      to,
      nonce,
      payload: payload,
    };

    return details;
  }

  // Init from source tx hash, depending on the source chain
  // we pull Transfer info from either IBC or a wh message
  private static async _fromTransaction(
    wh: Wormhole,
    from: TransactionId,
  ): Promise<GatewayTransferDetails> {
    const { chain, txid } = from;

    const originChain = wh.getChain(chain);

    // If its origin chain is Cosmos, itll be an IBC message
    if (chainToPlatform(chain) === 'Cosmwasm') {
      // Get the ibc tx info from the origin
      const ibcBridge = await originChain.getIbcBridge();
      const xfer = await ibcBridge.lookupTransferFromTx(from.txid);
      return await GatewayTransfer._fromIbcTransfer(xfer);
    }

    // Otherwise grab the vaa details from the origin tx
    const [whMsgId] = await originChain.parseTransaction(txid);
    return await GatewayTransfer._fromMsgId(wh, whMsgId);
  }

  // Recover transfer info the first step in the transfer
  private static async _fromIbcTransfer(
    xfer: IBCTransferInfo,
  ): Promise<GatewayTransferDetails> {
    const token = {
      chain: xfer.tx.chain,
      address: toNative(xfer.tx.chain, xfer.data.denom),
    } as TokenId;

    const msg = asGatewayMsg(xfer.data.memo);
    const destChain = toChainName(msg.chain);

    const _recip = Buffer.from(msg.recipient, 'base64');
    const recipient: ChainAddress =
      chainToPlatform(destChain) === 'Cosmwasm'
        ? {
            chain: destChain,
            address: toNative(destChain, _recip.toString()),
          }
        : {
            chain: destChain,
            address: toNative(
              destChain,
              new UniversalAddress(new Uint8Array(_recip)),
            ),
          };

    const payload = msg.payload
      ? new Uint8Array(Buffer.from(msg.payload))
      : undefined;

    const details: GatewayTransferDetails = {
      token,
      amount: BigInt(xfer.data.amount),
      from: {
        chain: xfer.tx.chain,
        address: toNative(xfer.tx.chain, xfer.data.sender),
      },
      to: recipient,
      fee: BigInt(msg.fee),
      payload,
    };

    return details;
  }

  // start the WormholeTransfer by submitting transactions to the source chain
  // returns a transaction hash
  async initiateTransfer(signer: Signer): Promise<TxHash[]> {
    /*
        0) Check current `state` is valid to call this (eg: state == Created)
        1) Figure out where to call and issue transactions  
        2) Update state
        3) return transaction ids
    */
    if (this.state !== TransferState.Created)
      throw new Error('Invalid state transition in `start`');

    this.transactions = await (this.fromCosmos()
      ? this._transferIbc(signer)
      : this._transfer(signer));

    // Update State Machine
    this.state = TransferState.Initiated;

    // TODO: start thread to grab tx info?

    return this.transactions.map((tx) => tx.txid);
  }

  private async _transfer(signer: Signer): Promise<TransactionId[]> {
    const tokenAddress =
      this.transfer.token === 'native' ? 'native' : this.transfer.token.address;

    const fromChain = this.wh.getChain(this.transfer.from.chain);

    // Build the message needed to send a transfer through the gateway
    const msg = gatewayTransferMsg(this.transfer);

    const tb = await fromChain.getTokenBridge();
    const xfer: AsyncGenerator<UnsignedTransaction> = tb.transfer(
      this.transfer.from.address,
      this.gatewayAddress,
      tokenAddress,
      this.transfer.amount,
      new Uint8Array(Buffer.from(JSON.stringify(msg))),
    );

    let unsigned: UnsignedTransaction[] = [];
    const txHashes: TxHash[] = [];
    for await (const tx of xfer) {
      unsigned.push(tx);
      if (!tx.parallelizable) {
        // sign/send
        txHashes.push(
          ...(await fromChain.sendWait(await signer.sign(unsigned))),
        );
        // reset unsigned
        unsigned = [];
      }
    }

    if (unsigned.length > 0) {
      txHashes.push(...(await fromChain.sendWait(await signer.sign(unsigned))));
    }

    return txHashes.map((t) => {
      return {
        txid: t,
        chain: fromChain.chain,
      };
    });
  }

  private async _transferIbc(signer: Signer): Promise<TransactionId[]> {
    if (this.transfer.token === 'native')
      throw new Error('Native not supported for IBC transfers');

    const fromChain = this.wh.getChain(this.transfer.from.chain);

    const ibcBridge = await fromChain.getIbcBridge();
    const xfer: AsyncGenerator<UnsignedTransaction> = ibcBridge.transfer(
      this.transfer.from.address,
      this.transfer.to,
      this.transfer.token.address,
      this.transfer.amount,
    );

    let unsigned: UnsignedTransaction[] = [];
    const txHashes: TxHash[] = [];
    for await (const tx of xfer) {
      unsigned.push(tx);
      if (!tx.parallelizable) {
        // sign/send
        txHashes.push(
          ...(await fromChain.sendWait(await signer.sign(unsigned))),
        );
        // reset unsigned
        unsigned = [];
      }
    }

    if (unsigned.length > 0) {
      txHashes.push(...(await fromChain.sendWait(await signer.sign(unsigned))));
    }

    return txHashes.map((t) => {
      return {
        txid: t,
        chain: fromChain.chain,
      };
    });
  }

  // wait for the Attestations to be ready
  async fetchAttestation(): Promise<AttestationId[]> {
    // Note: this method probably does too much

    if (
      this.state < TransferState.Initiated ||
      this.state > TransferState.Attested
    )
      throw new Error('Invalid state transition in `fetchAttestation`');

    const attestations: AttestationId[] = [];
    this.ibcTransfers = [];

    const wcIbc = await this.wc.getIbcBridge();

    // collect ibc transfers and additional transaction ids
    if (this.fromCosmos()) {
      // assume all the txs are from the same chain
      // and get the ibc bridge once
      const chain = this.wh.getChain(this.transfer.from.chain);
      const bridge = await chain.getIbcBridge();

      // Ultimately we need to find the corresponding Wormchain transaction
      // from the intitiating cosmos chain

      // start by getting the IBC transfers into wormchain
      // from the cosmos chain
      const _ibcTransfers = await Promise.all(
        this.transactions.map(async (tx) => {
          return await bridge.lookupTransferFromTx(tx.txid);
        }),
      );
      this.ibcTransfers = _ibcTransfers.flat();

      if (this.ibcTransfers.length != 1) throw new Error('why?');

      // now find the corresponding wormchain transaction given the ibcTransfer info
      const { sequence, dstChannel } = this.ibcTransfers[0];
      const wcTransfer = await wcIbc.lookupTransferFromSequence(
        dstChannel,
        true,
        sequence,
      );

      // The transaction we want to check for a VAA (if a VAA was issued) is
      // the one that wormchain issued
      this.transactions.push(wcTransfer.tx);

      if (!this.toCosmos()) {
        const { tx } = wcTransfer;
        const [whm] = await this.wh
          .getChain(tx.chain)
          .parseTransaction(tx.txid);
        const vaa = await GatewayTransfer.getTransferVaa(
          this.wh,
          whm.chain,
          whm.emitter,
          whm.sequence,
        );
        this.vaas = [{ id: whm, vaa }];

        attestations.push(whm);
      }
    } else {
      // otherwise we're coming from outside cosmos and
      // we need to find the wormchain ibc transaction information
      // by searching for the transaction containing the
      // GatewayTransferMsg

      const tx = this.transactions[this.transactions.length - 1];
      const [whm] = await this.wh.getChain(tx.chain).parseTransaction(tx.txid);
      const vaa = await GatewayTransfer.getTransferVaa(
        this.wh,
        whm.chain,
        whm.emitter,
        whm.sequence,
      );
      this.vaas = [{ id: whm, vaa }];

      attestations.push(whm);

      // TODO: I'm dumb @ this
      // Wait until the vaa is redeemed before trying to look up the
      // transfer message
      while (!(await this.isVaaRedeemed([vaa]))) {
        console.log('VAA redeemed yet, trying again in 2s');
        await new Promise((r) => setTimeout(r, 2000));
      }

      // TODO: Add wait/retry
      // Note: because we search by GatewayTransferMsg payload
      // there is a possibility of dupe messages being returned
      // using a nonce should help
      const msg = gatewayTransferMsg(this.transfer);
      while (!(await this.isDelivered(msg))) {
        console.log('Transfer not delivered, waiting');
        await new Promise((r) => setTimeout(r, 2000));
      }
      const wcTransfer = await wcIbc.lookupTransferFromMsg(msg);
      this.ibcTransfers.push(wcTransfer);
    }

    // Add transfers to attestations we return
    attestations.push(...this.ibcTransfers);

    this.state = TransferState.Attested;

    return attestations;
  }

  async isVaaRedeemed(
    vaas: (VAA<'Transfer'> | VAA<'TransferWithPayload'>)[],
  ): Promise<boolean> {
    const wcTb = await this.wc.getTokenBridge();
    const redeemed = await Promise.all(
      vaas.map((v) => {
        return wcTb.isTransferCompleted(v);
      }),
    );

    return redeemed.every((v) => v);
  }

  async isDelivered(
    msg: GatewayTransferMsg | GatewayTransferWithPayloadMsg,
  ): Promise<boolean> {
    const wcIbc = await this.wc.getIbcBridge();

    try {
      const ibcTransferFromWormchain = await wcIbc.lookupTransferFromMsg(msg);
      return !ibcTransferFromWormchain.pending;
    } catch (e) {}

    return false;
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

    if (!this.toCosmos())
      throw new Error(
        'Complete transfer is not necessary for Gateway supported chains',
      );

    if (this.state < TransferState.Attested)
      throw new Error(
        'Invalid state transition in `finish`. Be sure to call `fetchAttestation`.',
      );

    if (!this.vaas) throw new Error('No VAA details available');

    const toChain = this.wh.getChain(this.transfer.to.chain);

    const toAddress = toNative(this.transfer.to.chain, signer.address())
      //@ts-ignore
      .toUniversalAddress();

    let unsigned: UnsignedTransaction[] = [];
    const txHashes: TxHash[] = [];
    for (const cachedVaa of this.vaas) {
      const { vaa } = cachedVaa;

      if (!vaa) throw new Error(`No VAA found for ${cachedVaa.id.sequence}`);

      const tb = await toChain.getTokenBridge();
      const xfer: AsyncGenerator<UnsignedTransaction> = tb.redeem(
        toAddress,
        vaa,
      );
      for await (const tx of xfer) {
        unsigned.push(tx);
        // If we find a tx that is not parallelizable, sign it and send
        // the accumulated txs so far
        if (!tx.parallelizable) {
          txHashes.push(
            ...(await toChain.sendWait(await signer.sign(unsigned))),
          );
          // reset unsigned
          unsigned = [];
        }
      }
    }

    if (unsigned.length > 0) {
      txHashes.push(...(await toChain.sendWait(await signer.sign(unsigned))));
    }
    return txHashes;
  }

  static async getTransferVaa(
    wh: Wormhole,
    chain: ChainName,
    emitter: UniversalAddress | NativeAddress<PlatformName>,
    sequence: bigint,
    retries: number = 5,
  ): Promise<VAA<'TransferWithPayload'> | VAA<'Transfer'>> {
    const vaaBytes = await wh.getVAABytes(chain, emitter, sequence, retries);
    if (!vaaBytes) throw new Error(`No VAA available after ${retries} retries`);

    const partial = deserialize('Uint8Array', vaaBytes);
    switch (partial.payload[0]) {
      case 1:
        return deserialize('Transfer', vaaBytes);
      case 3:
        return deserialize('TransferWithPayload', vaaBytes);
    }
    throw new Error(`No serde defined for type: ${partial.payload[0]}`);
  }

  private fromCosmos(): boolean {
    return chainToPlatform(this.transfer.from.chain) === 'Cosmwasm';
  }
  private toCosmos(): boolean {
    return chainToPlatform(this.transfer.to.chain) === 'Cosmwasm';
  }
}
