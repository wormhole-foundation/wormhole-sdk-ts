import {
  Signer,
  TokenId,
  TxHash,
  SequenceId,
  ChainContext,
  TokenTransferDetails,
  TokenTransferTransaction,
  MessageIdentifier,
  TransactionIdentifier,
  isMessageIdentifier,
  isTokenTransferDetails,
  isTransactionIdentifier,
} from './types';
import { WormholeTransfer, TransferState } from './wormholeTransfer';
import { Wormhole } from './wormhole';
import {
  TokenBridge,
  UniversalAddress,
  UnsignedTransaction,
  VAA,
  deserialize,
} from '@wormhole-foundation/sdk-definitions';
import { ChainName, PlatformName } from '@wormhole-foundation/sdk-base';

/**
 * What do with multiple transactions or VAAs?
 * What do for `stackable` transactions?
 * More concurrent promises instead of linearizing/blocking
 * How should we handle retrying VAA grabing? move to Wormhole?
 */

export class TokenTransfer implements WormholeTransfer {
  private readonly wh: Wormhole;

  // state machine tracker
  private state: TransferState;

  // transfer details
  transfer: TokenTransferDetails;

  from: UniversalAddress;
  fromSigner?: Signer;
  private fromTokenBridge?: TokenBridge<PlatformName>;

  to: UniversalAddress;
  toSigner?: Signer;
  private toTokenBridge?: TokenBridge<PlatformName>;

  // The corresponding vaa representing the TokenTransfer
  // on the source chain (if its been completed and finalized)
  vaas?: {
    emitter: UniversalAddress;
    sequence: bigint;
    vaa?: VAA<'Transfer'> | VAA<'TransferWithPayload'>;
  }[];

  private constructor(wh: Wormhole, transfer: TokenTransferDetails) {
    this.state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;

    if (transfer.from instanceof UniversalAddress) {
      this.from = transfer.from;
    } else {
      this.fromSigner = transfer.from;
      this.from = transfer.fromChain.platform.parseAddress(
        transfer.from.address(),
      );
    }

    if (transfer.to instanceof UniversalAddress) {
      this.to = transfer.to;
    } else {
      this.toSigner = transfer.to;
      this.to = transfer.toChain.platform.parseAddress(transfer.to.address());
    }
  }

  transferState(): TransferState {
    return this.state;
  }

  // Static initializers for in flight transfers that have not been completed
  static async from(
    wh: Wormhole,
    from: TokenTransferDetails,
  ): Promise<TokenTransfer>;
  static async from(
    wh: Wormhole,
    from: MessageIdentifier,
  ): Promise<TokenTransfer>;
  static async from(
    wh: Wormhole,
    from: TransactionIdentifier,
  ): Promise<TokenTransfer>;
  static async from(
    wh: Wormhole,
    from: TokenTransferDetails | MessageIdentifier | TransactionIdentifier,
  ): Promise<TokenTransfer> {
    let tt: TokenTransfer | undefined;

    if (isMessageIdentifier(from)) {
      tt = await TokenTransfer.fromIdentifier(wh, from);
    } else if (isTransactionIdentifier(from)) {
      tt = await TokenTransfer.fromTransaction(wh, from);
    } else if (isTokenTransferDetails(from)) {
      tt = new TokenTransfer(wh, from);
    }

    if (tt === undefined)
      throw new Error('Invalid `from` parameter for TokenTransfer');

    // cache token bridges
    tt.fromTokenBridge = await tt.transfer.fromChain.getTokenBridge();
    tt.toTokenBridge = await tt.transfer.toChain.getTokenBridge();

    return tt;
  }

  // init from the seq id
  private static async fromIdentifier(
    wh: Wormhole,
    from: MessageIdentifier,
  ): Promise<TokenTransfer> {
    const { chain, address: emitter } = from;
    const vaa = await TokenTransfer.waitForTransferVaa(
      wh,
      chain,
      emitter,
      from.sequence,
    );

    const details: TokenTransferDetails = {
      token: { ...vaa.payload.token },
      amount: vaa.payload.token.amount,
      toChain: wh.getChain(vaa.payload.to.chain),
      fromChain: wh.getChain(vaa.emitterChain),
      // TODO: this is a lie, but its ok because we no longer have `from` info
      from: emitter,
      to: vaa.payload.to.address,
    };

    const tt = new TokenTransfer(wh, details);

    tt.vaas = [
      {
        emitter: vaa.emitterAddress,
        sequence: vaa.sequence,
        vaa: vaa,
      },
    ];

    tt.state = TransferState.Ready;

    return tt;
  }
  // init from source tx hash
  private static async fromTransaction(
    wh: Wormhole,
    from: TransactionIdentifier,
  ): Promise<TokenTransfer> {
    const { chain, txid } = from;

    const c = wh.getChain(chain);

    const parsedTxDeets: TokenTransferTransaction[] = await c.getTransaction(
      txid,
    );

    const [tx] = parsedTxDeets;

    const fromChain = wh.getChain(tx.fromChain);
    const toChain = wh.getChain(tx.toChain);
    const details: TokenTransferDetails = {
      token: tx.tokenId,
      amount: tx.amount,
      fromChain,
      toChain,
      from: fromChain.platform.parseAddress(tx.sender),
      to: toChain.platform.parseAddress(tx.recipient),
    };

    const tt = new TokenTransfer(wh, details);

    tt.state = TransferState.Started;

    const emitter = details.fromChain.platform.parseAddress(tx.emitterAddress);

    const vaa = await TokenTransfer.waitForTransferVaa(
      wh,
      chain,
      emitter,
      tx.sequence,
    );

    tt.vaas = [
      {
        emitter: emitter,
        sequence: tx.sequence,
        vaa: vaa,
      },
    ];

    tt.state = TransferState.Ready;
    return tt;
  }

  // start the WormholeTransfer by submitting transactions to the source chain
  // returns a transaction hash
  async start(signer?: Signer): Promise<TxHash[]> {
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

    const xfer = this.fromTokenBridge!.transfer(
      this.from,
      { chain: this.transfer.toChain.chain, address: this.to },
      tokenAddress,
      this.transfer.amount,
      this.transfer.payload,
    );

    // TODO: check 'stackable'?
    const unsigned: UnsignedTransaction[] = [];
    for await (const tx of xfer) {
      if (!tx.stackable) {
        // sign/send
      }
      unsigned.push(tx);
    }

    const s = signer ? signer : this.fromSigner;
    if (s === undefined) throw new Error('No signer defined');

    const txHashes = await this.transfer.fromChain.sendWait(
      await s.sign(unsigned),
    );

    this.state = TransferState.Started;

    // TODO: concurrent
    for (const txHash of txHashes) {
      const txRes = await this.transfer.fromChain.getTransaction(txHash);

      // TODO:
      if (txRes.length != 1) throw new Error('Idk what to do with != 1');
      const [tx] = txRes;

      const emitter = this.transfer.fromChain.platform.parseAddress(
        tx.emitterAddress,
      );

      if (!this.vaas) this.vaas = [];

      this.vaas.push({
        emitter: emitter,
        sequence: txRes[0].sequence,
      });
    }

    return txHashes;
  }

  // wait for the VAA to be ready
  // returns the sequence number
  async ready(): Promise<SequenceId[]> {
    /*
        0) check that the current `state` is valid to call this  (eg: state == Started)
        1) poll the api on an interval to check if the VAA is available
        2) Once available, pull the VAA and parse it
        3) return seq
    */
    if (this.state < TransferState.Started || this.state > TransferState.Ready)
      throw new Error('Invalid state transition in `ready`');

    if (!this.vaas || this.vaas.length == 0)
      throw new Error('No VAA details available');

    // Check if we already have the VAA
    for (const idx in this.vaas) {
      // already got it
      if (this.vaas[idx].vaa) continue;

      this.vaas[idx].vaa = await TokenTransfer.waitForTransferVaa(
        this.wh,
        this.transfer.fromChain.chain,
        this.vaas[idx].emitter,
        this.vaas[idx].sequence,
      );
    }

    this.state = TransferState.Ready;
    return this.vaas.map((v) => {
      return v.sequence;
    });
  }

  // finish the WormholeTransfer by submitting transactions to the destination chain
  // returns a transaction hash
  async finish(signer?: Signer): Promise<TxHash[]> {
    /*
        0) check that the current `state` is valid to call this  (eg: state == Ready)
        1) prepare the transactions and sign them given the signer
        2) submit the VAA and transactions on chain
        3) return txid of submission
    */
    if (this.state < TransferState.Ready)
      throw new Error('Invalid state transition in `finish`');

    // TODO: fetch it for 'em? We should _not_ be Ready if we dont have these
    if (!this.vaas) throw new Error('No VAA details available');

    const unsigned: UnsignedTransaction[] = [];
    for (const cachedVaa of this.vaas) {
      const vaa = cachedVaa.vaa
        ? cachedVaa.vaa
        : await TokenTransfer.waitForTransferVaa(
            this.wh,
            this.transfer.fromChain.chain,
            cachedVaa.emitter,
            cachedVaa.sequence,
          );

      if (!vaa) throw new Error('No Vaa found');

      const xfer = this.toTokenBridge!.redeem(this.to, vaa);

      // TODO: check 'stackable'?
      for await (const tx of xfer) {
        unsigned.push(tx);
      }
    }

    const s = signer ? signer : this.toSigner;
    if (s === undefined) throw new Error('No signer defined');

    return await this.transfer.toChain.sendWait(await s.sign(unsigned));
  }

  // TODO: move retry/wait logic to Wormhole
  static async waitForTransferVaa(
    wh: Wormhole,
    chain: ChainName,
    emitter: UniversalAddress,
    sequence: bigint,
    retries: number = 5,
  ): Promise<VAA<'Transfer'>> {
    let vaaBytes: Uint8Array | undefined;
    for (let i = retries; i > 0 && !vaaBytes; i--) {
      console.log(`Waiting for vaa (${i} retries left)`);

      // TODO: config wait seconds?
      if (i != retries) await new Promise((f) => setTimeout(f, 2000));

      try {
        vaaBytes = await wh.getVAABytes(chain, emitter, sequence);
      } catch (e) {
        console.error(`Caught an error waiting for VAA: ${e}`);
      }
    }

    if (!vaaBytes)
      throw new Error('No vaa for the provided chain/emitter/sequence');

    return deserialize('Transfer', vaaBytes);
  }
}
