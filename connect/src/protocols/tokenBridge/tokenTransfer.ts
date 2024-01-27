import { Chain, Network, Platform } from "@wormhole-foundation/sdk-base";
import {
  AttestationId,
  AutomaticTokenBridge,
  ChainContext,
  ProtocolName,
  Signer,
  TokenBridge,
  TokenTransferDetails,
  TxHash,
} from "@wormhole-foundation/sdk-definitions";
import { AttestationReceipt, TransferReceipt, TransferState } from "../../types";
import { Wormhole } from "../../wormhole";

export type TokenTransferProtocol = "TokenBridge" | "AutomaticTokenBridge";
export type TokenTransferVAA = TokenBridge.TransferVAA | AutomaticTokenBridge.VAA;

export type TokenTransferAttestationReceipt = AttestationReceipt<TokenTransferProtocol>;
export type TokenTransferReceipt<
  SC extends Chain = Chain,
  DC extends Chain = Chain,
> = TransferReceipt<TokenTransferAttestationReceipt, SC, DC>;

export abstract class TokenTransfer<
  N extends Network = Network,
  PN extends ProtocolName = ProtocolName,
> {
  wh: Wormhole<N>;
  fromChain: ChainContext<N, Platform, Chain>;
  toChain: ChainContext<N, Platform, Chain>;

  transfer: TokenTransferDetails;
  receipt: TransferReceipt<AttestationReceipt<PN>>;

  constructor(
    wh: Wormhole<N>,
    transfer: TokenTransferDetails,
    fromChain?: ChainContext<N, Platform, Chain>,
    toChain?: ChainContext<N, Platform, Chain>,
  ) {
    this.wh = wh;
    this.transfer = transfer;

    this.fromChain = fromChain ?? wh.getChain(transfer.from.chain);
    this.toChain = toChain ?? wh.getChain(transfer.to.chain);

    this.receipt = {
      from: transfer.from.chain,
      to: transfer.to.chain,
      state: TransferState.Created,
    };
  }

  abstract initiateTransfer(signer: Signer): Promise<TxHash[]>;
  abstract fetchAttestation(timeout?: number): Promise<AttestationId[]>;
  abstract completeTransfer(signer: Signer): Promise<TxHash[]>;
}
