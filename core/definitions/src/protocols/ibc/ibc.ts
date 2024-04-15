import type { Chain, ChainId, Network } from "@wormhole-foundation/sdk-base";
import { encoding, toChain, toChainId } from "@wormhole-foundation/sdk-base";
import type { AccountAddress, ChainAddress, NativeAddress } from "../../address.js";
import type { IbcMessageId, WormholeMessageId } from "../../attestation.js";
import type { TokenAddress, TokenId, TxHash } from "../../types.js";
import type { UnsignedTransaction } from "../../unsignedTransaction.js";

import "../../registry.js";
import { EmptyPlatformMap } from "../../protocol.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface ProtocolToInterfaceMapping<N, C> {
      IbcBridge: IbcBridge<N, C>;
    }
    interface ProtocolToPlatformMapping {
      IbcBridge: EmptyPlatformMap<"IbcBridge">;
    }
  }
}

/** Configuration for a transfer through the Gateway */
export type GatewayTransferDetails = {
  token: TokenId;
  amount: bigint;
  from: ChainAddress;
  to: ChainAddress;
  nonce?: number;
  fee?: bigint;
  payload?: Uint8Array;
  nativeGas?: bigint;
};

/**
 * Holds the data of a gateway message without
 * special keys required by cosmos contracts
 */
export interface GatewayMsg {
  chain: ChainId;
  recipient: string;
  fee: string;
  nonce: number;
  payload?: string;
}

// GatewayTransferMsg is the message sent in the payload
// of a TokenTransfer to be executed by the Gateway contract.
export interface GatewayTransferMsg {
  gateway_transfer: Exclude<GatewayMsg, "payload">;
}

// GatewayTransferWithPayloadMsg is the message sent in the payload of a
// TokenTransfer with its own payload to be executed by the Gateway contract.
export interface GatewayTransferWithPayloadMsg {
  gateway_transfer_with_payload: GatewayMsg;
}

// GatewayIBCTransferMsg is the message sent in the memo of an IBC transfer
// to be decoded and executed by the Gateway contract.
export interface GatewayIbcTransferMsg {
  gateway_ibc_token_bridge_payload: GatewayTransferMsg | GatewayTransferWithPayloadMsg;
}

export function isGatewayTransferMsg(thing: GatewayTransferMsg | any): thing is GatewayTransferMsg {
  return (<GatewayTransferMsg>thing).gateway_transfer !== undefined;
}

export function isGatewayTransferWithPayloadMsg(
  thing: GatewayTransferWithPayloadMsg | any,
): thing is GatewayTransferWithPayloadMsg {
  return (<GatewayTransferWithPayloadMsg>thing).gateway_transfer_with_payload !== undefined;
}

export function isGatewayIbcTransferMsg(
  thing: GatewayIbcTransferMsg | any,
): thing is GatewayIbcTransferMsg {
  return (<GatewayIbcTransferMsg>thing).gateway_ibc_token_bridge_payload !== undefined;
}

export function isGatewayTransferDetails(
  thing: GatewayTransferDetails | any,
): thing is GatewayTransferDetails {
  return (
    (<GatewayTransferDetails>thing).token !== undefined &&
    (<GatewayTransferDetails>thing).amount !== undefined &&
    (<GatewayTransferDetails>thing).from !== undefined &&
    (<GatewayTransferDetails>thing).to !== undefined
  );
}

// Get the underlying payload from a gateway message
// without prefix
export function toGatewayMsg(
  msg: GatewayTransferMsg | GatewayTransferWithPayloadMsg | GatewayIbcTransferMsg | string,
): GatewayMsg {
  if (typeof msg === "string") msg = JSON.parse(msg);

  if (isGatewayIbcTransferMsg(msg)) msg = msg.gateway_ibc_token_bridge_payload;
  if (isGatewayTransferMsg(msg)) return msg.gateway_transfer;
  if (isGatewayTransferWithPayloadMsg(msg)) return msg.gateway_transfer_with_payload;

  throw new Error(`Unrecognized payload: ${msg}`);
}

export function gatewayTransferMsg(
  gtd: GatewayTransferDetails | GatewayMsg,
): GatewayTransferMsg | GatewayTransferWithPayloadMsg {
  if (isGatewayTransferDetails(gtd)) {
    // If we've already got a payload, b64 encode it so it works in json
    const _payload = gtd.payload ? encoding.b64.encode(gtd.payload) : undefined;

    // Encode the payload so the gateway contract knows where to forward the
    // newly minted tokens
    return makeGatewayTransferMsg(
      gtd.to.chain,
      gtd.to.address.toNative(gtd.to.chain),
      gtd.fee,
      gtd.nonce ?? Math.round(Math.random() * 100000),
      _payload,
    );
  }

  // Encode the payload so the gateway contract knows where to forward the
  // newly minted tokens
  return makeGatewayTransferMsg(
    toChain(gtd.chain),
    gtd.recipient,
    BigInt(gtd.fee),
    gtd.nonce,
    gtd.payload,
  );
}

export function makeGatewayTransferMsg<CN extends Chain>(
  chain: CN,
  recipient: NativeAddress<CN> | string,
  fee: bigint = 0n,
  nonce: number,
  payload?: string,
): GatewayTransferWithPayloadMsg | GatewayTransferMsg {
  // Address of recipient is b64 encoded Cosmos bech32 address
  // If its already a string, assume its been b64 encoded
  const address =
    typeof recipient === "string"
      ? recipient
      : // @ts-ignore
        encoding.b64.encode(recipient.toString());

  const common = {
    chain: toChainId(chain),
    recipient: address,
    fee: fee.toString(),
    nonce: nonce,
  };

  const msg: GatewayTransferWithPayloadMsg | GatewayTransferMsg = payload
    ? ({
        gateway_transfer_with_payload: { ...common, payload: payload },
      } as GatewayTransferWithPayloadMsg)
    : ({ gateway_transfer: { ...common } } as GatewayTransferMsg);

  return msg;
}

// Summary of an IBCTransfer with the message
// payload and a pending flag if we find it
// in the PendingCommitment queue
export interface IbcTransferInfo {
  id: IbcMessageId;
  data: IbcTransferData;
  pending: boolean;
}

export function isIbcTransferInfo(thing: IbcTransferInfo | any): thing is IbcTransferInfo {
  return (
    (<IbcTransferInfo>thing).id !== undefined &&
    (<IbcTransferInfo>thing).pending !== undefined &&
    (<IbcTransferInfo>thing).data !== undefined
  );
}

/**
 * The expected payload sent as a string over IBC
 */
export interface IbcTransferData {
  amount: string;
  denom: string;
  memo: string;
  receiver: string;
  sender: string;
}

/**
 * IbcBridge provides an interface to use the IBC token transfer protocol
 *
 * See more here {@link https://tutorials.cosmos.network/academy/3-ibc/7-token-transfer.html}
 *
 */
export interface IbcBridge<N extends Network = Network, C extends Chain = Chain> {
  /** Initiate an IBC token transfer */
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;

  /** Get the transfer channel for a remote chain, pulled from local cache */
  getTransferChannel(chain: Chain): string | null;

  /** Get the transfer channel for a remote chain, pulled from contract */
  fetchTransferChannel(chain: Chain): Promise<string | null>;

  /**
   * Find the wormhole emitted message id for a given IBC transfer
   * if it does not exist, this will return null
   */
  lookupMessageFromIbcMsgId(msg: IbcMessageId): Promise<WormholeMessageId | null>;

  /** Find the IBCTransferInfo given a transaction id */
  lookupTransferFromTx(txid: TxHash): Promise<IbcTransferInfo[]>;
  /** Find the IBCTransferInfo from a message id */
  lookupTransferFromIbcMsgId(msg: IbcMessageId): Promise<IbcTransferInfo[]>;
  /** Find the IBCTransferInfo from a gateway transfer message */
  lookupTransferFromMsg(
    payload: GatewayTransferMsg | GatewayTransferWithPayloadMsg,
  ): Promise<IbcTransferInfo[]>;
}
