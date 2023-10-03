import {
  NativeAddress,
  UniversalAddress,
  UnsignedTransaction,
  VAA,
  deserialize,
  Signer,
  TxHash,
  WormholeMessageId,
  TransactionId,
  isWormholeMessageId,
  isTransactionIdentifier,
  toNative,
  ChainAddress,
} from '@wormhole-foundation/sdk-definitions';
import {
  GatewayTransferDetails,
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
  isGatewayTransferDetails,
} from '../types';
import {
  WormholeTransfer,
  TransferState,
  AttestationId,
} from '../wormholeTransfer';
import { Wormhole } from '../wormhole';
import {
  ChainName,
  PlatformName,
  chainToPlatform,
  toChainId,
} from '@wormhole-foundation/sdk-base';

/**
 * What do with multiple transactions or VAAs?
 * More concurrent promises instead of linearizing/blocking
 */

export class GatewayTransfer implements WormholeTransfer {
  private readonly wh: Wormhole;

  // state machine tracker
  private state: TransferState;

  // transfer details
  transfer: GatewayTransferDetails;

  // Source txids
  txids?: TxHash[];

  // The corresponding vaa representing the GatewayTransfer
  // on the source chain (if its been completed and finalized)
  vaas?: {
    id: WormholeMessageId;
    vaa?: VAA<'Transfer'> | VAA<'TransferWithPayload'>;
  }[];

  private constructor(wh: Wormhole, transfer: GatewayTransferDetails) {
    this.state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;
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
    let tt: GatewayTransfer | undefined;

    if (isWormholeMessageId(from)) {
      tt = await GatewayTransfer.fromIdentifier(wh, from);
    } else if (isTransactionIdentifier(from)) {
      tt = await GatewayTransfer.fromTransaction(wh, from);
    } else if (isGatewayTransferDetails(from)) {
      tt = new GatewayTransfer(wh, from);
    }

    if (tt === undefined)
      throw new Error('Invalid `from` parameter for GatewayTransfer');

    return tt;
  }

  // init from the seq id
  private static async fromIdentifier(
    wh: Wormhole,
    from: WormholeMessageId,
  ): Promise<GatewayTransfer> {
    const { chain, emitter, sequence } = from;
    const vaa = await GatewayTransfer.getTransferVaa(
      wh,
      chain,
      emitter,
      sequence,
    );

    // Check if its a payload 3 targeted at a relayer on the destination chain
    // const { address } = vaa.payload.to;
    // const { relayer } = wh.conf.chains[chain]!.contracts;

    // let automatic = false;
    // if (relayer) {
    //   const relayerAddress = toNative(chain, relayer);
    //   automatic =
    //     vaa.payloadLiteral === 'TransferWithPayload' &&
    //     //@ts-ignore
    //     address.equals(relayerAddress.toUniversalAddress());
    // }

    const details: GatewayTransferDetails = {
      token: { ...vaa.payload.token },
      amount: vaa.payload.token.amount,
      // TODO: the `from.address` here is a lie, but we don't
      // immediately have enough info to get the _correct_ one
      from: { chain: from.chain, address: from.emitter },
      to: { ...vaa.payload.to },
    };

    const tt = new GatewayTransfer(wh, details);
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
  ): Promise<GatewayTransfer> {
    const { chain, txid } = from;

    const originChain = wh.getChain(chain);

    const parsed: WormholeMessageId[] = await originChain.parseTransaction(
      txid,
    );

    // TODO: assuming single tx
    const [msg] = parsed;
    const tt = await GatewayTransfer.fromIdentifier(wh, msg);
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

    if (chainToPlatform(this.transfer.from.chain) === 'Cosmwasm') {
      return this.initiateTransferIbc(signer);
      // ibc transfer?
    }

    const tokenAddress =
      this.transfer.token === 'native' ? 'native' : this.transfer.token.address;

    const fromChain = this.wh.getChain(this.transfer.from.chain);

    // Encode the payload so the gateway contract knows where to forward the
    // newly minted tokens

    // TODO: force string encoded payload or adhere to b64 encoding it?
    let _payload = this.transfer.payload
      ? Buffer.from(this.transfer.payload).toString('base64')
      : undefined;

    const msg = GatewayTransfer.transferMsg(
      this.transfer.to.chain,
      this.transfer.to.address as NativeAddress<'Cosmwasm'>,
      0n,
      _payload,
    );
    const payload = new Uint8Array(Buffer.from(msg));

    const gatewayAddress = this.gatewayAddress();

    const tb = await fromChain.getTokenBridge();
    const xfer: AsyncGenerator<UnsignedTransaction> = tb.transfer(
      this.transfer.from.address,
      gatewayAddress,
      tokenAddress,
      this.transfer.amount,
      payload,
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

  async initiateTransferIbc(signer: Signer): Promise<string[]> {
    /*
    let _payload = this.transfer.payload
      ? Buffer.from(this.transfer.payload).toString('base64')
      : undefined;

    const msg = GatewayTransfer.transferMsg(
      this.transfer.from.chain,
      this.transfer.to.address as NativeAddress<'Cosmwasm'>,
      0n,
      _payload,
    );
    */

    const tokenAddress =
      this.transfer.token === 'native' ? 'native' : this.transfer.token.address;

    const fromChain = this.wh.getChain(this.transfer.from.chain);

    const ibcBridge = await fromChain.getIbcBridge();
    const xfer: AsyncGenerator<UnsignedTransaction> = ibcBridge.transfer(
      this.transfer.from.address,
      this.transfer.to,
      tokenAddress,
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

      this.vaas[idx].vaa = await GatewayTransfer.getTransferVaa(
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
  ): Promise<VAA<'TransferWithPayload'>> {
    const vaaBytes = await wh.getVAABytes(chain, emitter, sequence, retries);
    if (!vaaBytes) throw new Error(`No VAA available after ${retries} retries`);

    const partial = deserialize('Uint8Array', vaaBytes);
    switch (partial.payload[0]) {
      case 3:
        return deserialize('TransferWithPayload', vaaBytes);
    }
    throw new Error(`No serde defined for type: ${partial.payload[0]}`);
  }

  static transferMsg(
    chain: ChainName,
    recipient: NativeAddress<'Cosmwasm'>,
    fee: bigint = 0n,
    payload?: string,
    nonce?: number,
  ): string {
    // Address of recipient is b64 encoded Cosmos bech32 address
    // @ts-ignore
    const address = Buffer.from(recipient.toString()).toString('base64');

    const common = {
      chain: toChainId(chain),
      recipient: address,
      fee: fee.toString(),
      nonce: nonce ?? Math.round(Math.random() * 100000),
    };

    const msg: GatewayTransferWithPayloadMsg | GatewayTransferMsg = payload
      ? ({
          gateway_transfer_with_payload: { ...common, payload: payload },
        } as GatewayTransferWithPayloadMsg)
      : ({ gateway_transfer: { ...common } } as GatewayTransferMsg);

    return JSON.stringify(msg);
  }

  private gatewayAddress(): ChainAddress {
    const chain = 'Wormchain';
    // reference from conf instead of asking the module
    // so we can keep from forcing install
    const gatewayAddress = this.wh.conf.chains[chain]!.contracts.gateway!;
    return {
      chain: chain,
      address: toNative(chain, gatewayAddress),
    };
  }
}
