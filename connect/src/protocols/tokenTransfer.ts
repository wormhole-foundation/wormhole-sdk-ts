import {
  NativeAddress,
  UniversalAddress,
  UnsignedTransaction,
  VAA,
  deserialize,
  Signer,
  TxHash,
  SequenceId,
  WormholeMessageId,
  TransactionId,
  isWormholeMessageId,
  isTransactionIdentifier,
  toNative,
} from '@wormhole-foundation/sdk-definitions';
import { isTokenTransferDetails, TokenTransferDetails } from '../types';
import {
  WormholeTransfer,
  TransferState,
  AttestationId,
} from '../wormholeTransfer';
import { Wormhole } from '../wormhole';
import { ChainName, PlatformName } from '@wormhole-foundation/sdk-base';

/**
 * What do with multiple transactions or VAAs?
 * More concurrent promises instead of linearizing/blocking
 */

export class TokenTransfer implements WormholeTransfer {
  private readonly wh: Wormhole;

  // state machine tracker
  private state: TransferState;

  // transfer details
  transfer: TokenTransferDetails;

  // Source txids
  txids?: TxHash[];

  // The corresponding vaa representing the TokenTransfer
  // on the source chain (if its been completed and finalized)
  vaas?: {
    id: WormholeMessageId;
    vaa?: VAA<'Transfer'> | VAA<'TransferWithPayload'>;
  }[];

  private constructor(wh: Wormhole, transfer: TokenTransferDetails) {
    this.state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;
  }

  async getTransferState(): Promise<TransferState> {
    if (!this.transfer.automatic) return this.state;
    if (!this.vaas || this.vaas.length === 0) return this.state;

    const { chain, emitter, sequence } = this.vaas[0].id;
    const txStatus = await this.wh.getTransactionStatus(
      chain,
      emitter,
      sequence,
    );

    if (txStatus.globalTx.destinationTx) {
      switch (txStatus.globalTx.destinationTx.status) {
        case 'completed':
          this.state = TransferState.Completed;
          break;
        // ... more?
      }
    }

    return this.state;
  }

  // Static initializers for in flight transfers that have not been completed
  static async from(
    wh: Wormhole,
    from: TokenTransferDetails,
  ): Promise<TokenTransfer>;
  static async from(
    wh: Wormhole,
    from: WormholeMessageId,
  ): Promise<TokenTransfer>;
  static async from(wh: Wormhole, from: TransactionId): Promise<TokenTransfer>;
  static async from(
    wh: Wormhole,
    from: TokenTransferDetails | WormholeMessageId | TransactionId,
  ): Promise<TokenTransfer> {
    let tt: TokenTransfer | undefined;

    if (isWormholeMessageId(from)) {
      tt = await TokenTransfer.fromIdentifier(wh, from);
    } else if (isTransactionIdentifier(from)) {
      tt = await TokenTransfer.fromTransaction(wh, from);
    } else if (isTokenTransferDetails(from)) {
      tt = new TokenTransfer(wh, from);
    }

    if (tt === undefined)
      throw new Error('Invalid `from` parameter for TokenTransfer');

    return tt;
  }

  // init from the seq id
  private static async fromIdentifier(
    wh: Wormhole,
    from: WormholeMessageId,
  ): Promise<TokenTransfer> {
    const { chain, emitter, sequence } = from;
    const vaa = await TokenTransfer.getTransferVaa(
      wh,
      chain,
      emitter,
      sequence,
    );

    // Check if its a payload 3 targeted at a relayer on the destination chain
    const { address } = vaa.payload.to;
    const { relayer } = wh.conf.chains[chain]!.contracts;

    let automatic = false;
    if (relayer) {
      const relayerAddress = wh.getChain(chain).parseAddress(relayer);
      automatic =
        vaa.payloadLiteral === 'TransferWithPayload' &&
        //@ts-ignore
        address.equals(relayerAddress.toUniversalAddress());
    }

    const details: TokenTransferDetails = {
      token: { ...vaa.payload.token },
      amount: vaa.payload.token.amount,
      // TODO: the `from.address` here is a lie, but we don't
      // immediately have enough info to get the _correct_ one
      from: { chain: from.chain, address: from.emitter },
      to: { ...vaa.payload.to },
      automatic,
    };

    const tt = new TokenTransfer(wh, details);
    tt.vaas = [
      { id: { emitter, sequence: vaa.sequence, chain: from.chain }, vaa },
    ];

    tt.state = TransferState.Attested;

    return tt;
  }
  // init from source tx hash
  private static async fromTransaction(
    wh: Wormhole,
    from: TransactionId,
  ): Promise<TokenTransfer> {
    const { chain, txid } = from;

    const originChain = wh.getChain(chain);

    const parsed: WormholeMessageId[] = await originChain.parseTransaction(
      txid,
    );

    // TODO: assuming single tx
    const [msg] = parsed;
    const tt = await TokenTransfer.fromIdentifier(wh, msg);
    tt.txids = [txid];

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
      throw new Error('Invalid state transition in `start`');

    const tokenAddress =
      this.transfer.token === 'native' ? 'native' : this.transfer.token.address;

    const fromChain = this.wh.getChain(this.transfer.from.chain);

    let xfer: AsyncGenerator<UnsignedTransaction>;
    if (this.transfer.automatic) {
      const tb = await fromChain.getAutomaticTokenBridge();
      const fee = await tb.getRelayerFee(
        this.transfer.from,
        this.transfer.to,
        this.transfer.token,
      );

      xfer = tb.transfer(
        this.transfer.from.address,
        this.transfer.to,
        tokenAddress,
        this.transfer.amount,
        fee,
        this.transfer.nativeGas,
      );
    } else {
      const tb = await fromChain.getTokenBridge();
      xfer = tb.transfer(
        this.transfer.from.address,
        this.transfer.to,
        tokenAddress,
        this.transfer.amount,
        this.transfer.payload,
      );
    }

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

    // Set txids and update statemachine
    this.txids = txHashes;
    this.state = TransferState.Initiated;

    // TODO: concurrent? wait for finalized somehow?
    for (const txHash of txHashes) {
      const parsed = await fromChain.parseTransaction(txHash);
      // TODO:
      if (parsed.length != 1)
        throw new Error(`Expected a single VAA, got ${parsed.length}`);

      const [{ emitter, sequence }] = parsed;

      if (!this.vaas) this.vaas = [];
      this.vaas.push({
        id: { emitter, sequence, chain: fromChain.chain },
      });
    }

    return txHashes;
  }

  // wait for the VAA to be ready
  // returns the sequence number
  async fetchAttestation(): Promise<AttestationId[]> {
    /*
        0) check that the current `state` is valid to call this  (eg: state == Started)
        1) poll the api on an interval to check if the VAA is available
        2) Once available, pull the VAA and parse it
        3) return seq
    */
    if (
      this.state < TransferState.Initiated ||
      this.state > TransferState.Attested
    )
      throw new Error('Invalid state transition in `ready`');

    if (!this.vaas || this.vaas.length == 0)
      throw new Error('No VAA details available');

    // Check if we already have the VAA
    for (const idx in this.vaas) {
      // already got it
      if (this.vaas[idx].vaa) continue;

      this.vaas[idx].vaa = await TokenTransfer.getTransferVaa(
        this.wh,
        this.transfer.from.chain,
        this.vaas[idx].id.emitter,
        this.vaas[idx].id.sequence,
      );
    }

    this.state = TransferState.Attested;
    return this.vaas.map((v) => {
      return v.id;
    });
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
      throw new Error(
        'Invalid state transition in `finish`. Be sure to call `fetchAttestation`.',
      );

    if (!this.vaas) throw new Error('No VAA details available');

    const toChain = this.wh.getChain(this.transfer.to.chain);

    const toAddress = toChain
      .parseAddress(signer.address())
      //@ts-ignore
      .toUniversalAddress();

    let unsigned: UnsignedTransaction[] = [];
    const txHashes: TxHash[] = [];
    for (const cachedVaa of this.vaas) {
      const { vaa } = cachedVaa;

      if (!vaa) throw new Error(`No VAA found for ${cachedVaa.id.sequence}`);

      let xfer: AsyncGenerator<UnsignedTransaction> | undefined;
      if (this.transfer.automatic) {
        if (vaa.payloadLiteral === 'Transfer')
          throw new Error(
            'VAA is a simple transfer but expected Payload for automatic delivery',
          );

        const tb = await toChain.getAutomaticTokenBridge();
        xfer = tb.redeem(toAddress, vaa);
      } else {
        const tb = await toChain.getTokenBridge();
        xfer = tb.redeem(toAddress, vaa);
      }

      // TODO: better error
      if (xfer === undefined)
        throw new Error('No handler defined for VAA type');

      for await (const tx of xfer) {
        unsigned.push(tx);
        // If we find a tx that is not parallelizable, sign it and send
        // the accumulated txs so far
        if (!tx.parallelizable) {
          const signedTxns = await signer.sign(unsigned);
          const txids = await toChain.sendWait(signedTxns);
          txHashes.push(...txids);
          // reset unsigned
          unsigned = [];
        }
      }
    }
    if (unsigned.length > 0) {
      const signedTxns = await signer.sign(unsigned);
      const txids = await toChain.sendWait(signedTxns);
      txHashes.push(...txids);
    }
    return txHashes;
  }

  static async getTransferVaa(
    wh: Wormhole,
    chain: ChainName,
    emitter: UniversalAddress | NativeAddress<PlatformName>,
    sequence: bigint,
    retries: number = 5,
  ): Promise<VAA<'Transfer'> | VAA<'TransferWithPayload'>> {
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
}
