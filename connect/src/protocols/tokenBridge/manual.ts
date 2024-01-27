import { Chain, Network, Platform } from "@wormhole-foundation/sdk-base";
import {
  AttestationId,
  ChainContext,
  Signer,
  TokenBridge,
  TokenTransferDetails,
  TransactionId,
  TxHash,
  toNative,
} from "@wormhole-foundation/sdk-definitions";
import { signSendWait } from "../../common";
import {
  ErrInvalidStateTransition,
  SourceInitiatedTransferReceipt,
  TransferState,
  hasAttested,
  hasSourceFinalized,
  hasSourceInitiated,
  isAttested,
  isCreated,
} from "../../types";
import { WormholeTransfer } from "../wormholeTransfer";
import { TokenTransfer } from "./tokenTransfer";
import { TokenTransferUtils } from "./utils";

type PN = "TokenBridge";
export class ManualTokenTransfer<N extends Network>
  extends TokenTransfer<N, PN>
  implements WormholeTransfer<PN>
{
  getTransferState(): TransferState {
    return this.receipt.state;
  }

  async initiateTransfer(signer: Signer): Promise<TxHash[]> {
    if (!isCreated(this.receipt))
      throw ErrInvalidStateTransition("Expected transfer details to be created");

    const originTxs = await ManualTokenTransfer.transfer(this.fromChain, this.transfer, signer);
    const state = TransferState.SourceInitiated;
    this.receipt = { ...this.receipt, state, originTxs } satisfies SourceInitiatedTransferReceipt;

    return originTxs.map(({ txid }) => txid);
  }

  async fetchAttestation(timeout?: number): Promise<AttestationId[]> {
    if (!hasSourceInitiated(this.receipt))
      throw ErrInvalidStateTransition("Expected source to be initiated");

    // We already have it, just return it
    if (hasAttested(this.receipt)) return [this.receipt.attestation.id];

    // We dont have the message id yet, grab it
    if (!hasSourceFinalized(this.receipt)) {
      const { originTxs } = this.receipt;
      const txid = originTxs[originTxs.length - 1]!;
      const msgId = await TokenTransferUtils.getTransferMessage(this.fromChain, txid.txid, timeout);
      this.receipt = {
        ...this.receipt,
        state: TransferState.SourceFinalized,
        attestation: { id: msgId },
      };
    }

    // No signed attestation yet, try to grab it
    if (!hasAttested(this.receipt)) {
      const vaa = await TokenTransferUtils.getTransferVaa(
        this.wh,
        this.receipt.attestation.id,
        timeout,
      );
      this.receipt = {
        ...this.receipt,
        state: TransferState.Attested,
        attestation: { id: this.receipt.attestation.id, attestation: vaa },
      };
    }

    return [this.receipt.attestation.id];
  }

  // finish the WormholeTransfer by submitting transactions to the destination chain
  // returns a transaction hash
  async completeTransfer(signer: Signer): Promise<TxHash[]> {
    if (!isAttested(this.receipt))
      throw ErrInvalidStateTransition("Expected transfer to be attested");

    const {
      attestation: { attestation: vaa },
    } = this.receipt;

    const destinationTxs = await ManualTokenTransfer.redeem<N>(
      this.toChain,
      vaa as TokenBridge.TransferVAA,
      signer,
    );

    this.receipt = {
      ...this.receipt,
      state: TransferState.DestinationInitiated,
      destinationTxs,
    };

    return this.receipt.destinationTxs!.map(({ txid }) => txid);
  }

  static async transfer<N extends Network>(
    chainCtx: ChainContext<N, Platform, Chain>,
    transfer: TokenTransferDetails,
    signer: Signer<N, Chain>,
  ): Promise<TransactionId[]> {
    const senderAddress = toNative(signer.chain(), signer.address());
    const tb = await chainCtx.getTokenBridge();
    const xfer = tb.transfer(
      senderAddress,
      transfer.to,
      transfer.token.address,
      transfer.amount,
      transfer.payload,
    );
    return signSendWait<N, typeof chainCtx.chain>(chainCtx, xfer, signer);
  }

  static async redeem<N extends Network>(
    toChain: ChainContext<N, Platform, Chain>,
    vaa: TokenBridge.TransferVAA,
    signer: Signer<N, Chain>,
  ): Promise<TransactionId[]> {
    const signerAddress = toNative(signer.chain(), signer.address());
    const tb = await toChain.getTokenBridge();
    const xfer = tb.redeem(signerAddress, vaa);
    return signSendWait<N, Chain>(toChain, xfer, signer);
  }
}
