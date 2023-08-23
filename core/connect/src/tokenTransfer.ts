import {
  Signer,
  TokenId,
  TxHash,
  SequenceId,
  ChainContext,
  TokenTransferTransaction,
} from './types';
import { WormholeTransfer, TransferState } from './wormholeTransfer';
import { Wormhole } from './wormhole';
import {
  UniversalAddress,
  UnsignedTransaction,
  VAA,
  deserialize,
} from '@wormhole-foundation/sdk-definitions';
import { ChainName } from '@wormhole-foundation/sdk-base';

export interface TokenTransferDetails {
  token: TokenId | 'native';
  amount: bigint;
  payload?: Uint8Array;
  fromChain: ChainContext;
  toChain: ChainContext;
}

export class TokenTransfer implements WormholeTransfer {
  // state machine tracker
  state: TransferState;

  wh: Wormhole;

  // transfer details
  transfer: TokenTransferDetails;

  from: UniversalAddress;
  fromSigner?: Signer;

  to: UniversalAddress;
  toSigner?: Signer;

  // The corresponding vaa representing the TokenTransfer
  // on the source chain (if its been completed and finalized)
  vaas?: {
    emitter: UniversalAddress;
    sequence: bigint;
    vaa?: VAA<'Transfer'> | VAA<'TransferWithPayload'>;
  }[];

  constructor(
    wh: Wormhole,
    transfer: TokenTransferDetails,
    from: Signer | UniversalAddress,
    to: Signer | UniversalAddress,
  ) {
    this.state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;

    if (from instanceof UniversalAddress) {
      this.from = from;
    } else {
      this.fromSigner = from;
      this.from = transfer.fromChain.platform.parseAddress(from.address());
    }

    if (to instanceof UniversalAddress) {
      this.to = to;
    } else {
      this.toSigner = to;
      this.to = transfer.toChain.platform.parseAddress(to.address());
    }
  }

  // Static initializers for in flight transfers that have not been completed

  // init from the seq id
  static async fromIdentifier(
    wh: Wormhole,
    chain: ChainName,
    emitter: UniversalAddress,
    sequence: bigint,
  ): Promise<TokenTransfer> {
    const vaa = await TokenTransfer.waitForTransferVaa(
      wh,
      chain,
      emitter,
      sequence,
    );

    // TODO: waiting for changes to make vaa parse
    const details: TokenTransferDetails = {
      token: [vaa.payload.token.chain, vaa.payload.token.address],
      amount: vaa.payload.token.amount,
      toChain: wh.getChain(vaa.payload.to.chain),
      fromChain: wh.getChain(vaa.emitterChain),
    };

    const tt = new TokenTransfer(
      wh,
      details,
      // TODO: this is a lie, but its ok because we no longer have `from` info
      emitter,
      vaa.payload.to.address,
    );

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
  static async fromTransaction(
    wh: Wormhole,
    chain: ChainName,
    txid: string,
  ): Promise<TokenTransfer> {
    const c = wh.getChain(chain);

    const parsedTxDeets: TokenTransferTransaction[] = await c.getTransaction(
      txid,
    );

    const [tx] = parsedTxDeets;

    const details: TokenTransferDetails = {
      token: tx.tokenId,
      amount: tx.amount,
      fromChain: wh.getChain(tx.fromChain),
      toChain: wh.getChain(tx.toChain),
    };

    const tt = new TokenTransfer(
      wh,
      details,
      details.fromChain.platform.parseAddress(tx.sender),
      details.toChain.platform.parseAddress(tx.recipient),
    );

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

    const tb = await this.transfer.fromChain.getTokenBridge();

    const tokenAddress =
      this.transfer.token === 'native' ? 'native' : this.transfer.token[1];

    const xfer = tb.transfer(
      this.from,
      [this.transfer.toChain.chain, this.to],
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

    // Check if we already have it
    if (this.vaas && this.vaas.length > 0) {
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
    // TODO: and if we dont? Where do we save txid or get seq ?
    return [];
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

    // TODO: fetch it for 'em
    if (!this.vaas) throw new Error('No Vaas');

    const unsigned = [];
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

      const tb = await this.transfer.toChain.getTokenBridge();
      const xfer = tb.redeem(this.to, vaa);

      // TODO: check 'stackable'?
      for await (const tx of xfer) {
        unsigned.push(tx);
      }
    }

    const s = signer ? signer : this.toSigner;
    if (s === undefined) throw new Error('No signer defined');

    return await this.transfer.toChain.sendWait(await s.sign(unsigned));
  }

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
