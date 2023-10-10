import {
  ChainId,
  ChainName,
  PlatformName,
  isChainId,
  toChainId,
} from "@wormhole-foundation/sdk-base";
import { ChainAddress, NativeAddress, UniversalOrNative } from "../address";
import { IbcMessageId, WormholeMessageId } from "../attestation";
import { RpcConnection } from "../rpc";
import { TokenId,  TxHash } from "../types";
import { UnsignedTransaction } from "../unsignedTransaction";

// Configuration for a transfer through the Gateway
export type GatewayTransferDetails = {
  token: TokenId | "native";
  amount: bigint;
  from: ChainAddress;
  to: ChainAddress;
  nonce?: number;
  fee?: bigint;
  payload?: Uint8Array;
  nativeGas?: bigint;
};

// Holds the data of a gateway message without
// special keys required by cosmos contracts
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
  gateway_transfer: {
    chain: ChainId;
    recipient: string;
    fee: string;
    nonce: number;
  };
}

// GatewayTransferWithPayloadMsg is the message sent in the payload of a
// TokenTransfer with its own payload to be executed by the Gateway contract.
export interface GatewayTransferWithPayloadMsg {
  gateway_transfer_with_payload: {
    chain: ChainId;
    recipient: string;
    fee: string;
    nonce: number;
    payload: string;
  };
}

// GatewayIBCTransferMsg is the message sent in the memo of an IBC transfer
// to be decoded and executed by the Gateway contract.
export interface GatewayIbcTransferMsg {
  gateway_ibc_token_bridge_payload:
    | GatewayTransferMsg
    | GatewayTransferWithPayloadMsg;
}

export function isGatewayTransferMsg(
  thing: GatewayTransferMsg | any
): thing is GatewayTransferMsg {
  return (<GatewayTransferMsg>thing).gateway_transfer !== undefined;
}

export function isGatewayTransferWithPayloadMsg(
  thing: GatewayTransferWithPayloadMsg | any
): thing is GatewayTransferWithPayloadMsg {
  return (
    (<GatewayTransferWithPayloadMsg>thing).gateway_transfer_with_payload !==
    undefined
  );
}

export function isGatewayIbcTransferMsg(
  thing: GatewayIbcTransferMsg | any
): thing is GatewayIbcTransferMsg {
  return (
    (<GatewayIbcTransferMsg>thing).gateway_ibc_token_bridge_payload !==
    undefined
  );
}

export function isGatewayTransferDetails(
  thing: GatewayTransferDetails | any
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
export function asGatewayMsg(
  msg:
    | GatewayTransferMsg
    | GatewayTransferWithPayloadMsg
    | GatewayIbcTransferMsg
    | string
): GatewayMsg {
  if (typeof msg === "string") msg = JSON.parse(msg);

  if (isGatewayIbcTransferMsg(msg)) msg = msg.gateway_ibc_token_bridge_payload;
  if (isGatewayTransferMsg(msg)) return msg.gateway_transfer;
  if (isGatewayTransferWithPayloadMsg(msg))
    return msg.gateway_transfer_with_payload;

  throw new Error(`Unrecognized payload: ${msg}`);
}

export function gatewayTransferMsg(
  gtd: GatewayTransferDetails | GatewayMsg
): GatewayTransferMsg | GatewayTransferWithPayloadMsg {
  if (isGatewayTransferDetails(gtd)) {
    // If we've already got a payload, b64 encode it so it works in json
    const _payload = gtd.payload
      ? Buffer.from(gtd.payload).toString("base64")
      : undefined;

    // Encode the payload so the gateway contract knows where to forward the
    // newly minted tokens
    return makeGatewayTransferMsg(
      gtd.to.chain,
      gtd.to.address as NativeAddress<"Cosmwasm">,
      gtd.fee,
      gtd.nonce ?? Math.round(Math.random() * 100000),
      _payload
    );
  }

  // Encode the payload so the gateway contract knows where to forward the
  // newly minted tokens
  return makeGatewayTransferMsg(
    gtd.chain,
    gtd.recipient,
    BigInt(gtd.fee),
    gtd.nonce,
    gtd.payload
  );
}

export function makeGatewayTransferMsg(
  chain: ChainName | ChainId,
  recipient: NativeAddress<"Cosmwasm"> | string,
  fee: bigint = 0n,
  nonce: number,
  payload?: string
): GatewayTransferWithPayloadMsg | GatewayTransferMsg {
  // Address of recipient is b64 encoded Cosmos bech32 address
  // If its already a string, assume its been b64 encoded
  const address =
    typeof recipient === "string"
      ? recipient
      : // @ts-ignore
        Buffer.from(recipient.toString()).toString("base64");

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

export function isIbcTransferInfo(
  thing: IbcTransferInfo | any
): thing is IbcTransferInfo {
  return (
    (<IbcTransferInfo>thing).id !== undefined &&
    (<IbcTransferInfo>thing).pending !== undefined &&
    (<IbcTransferInfo>thing).data !== undefined
  );
}

// The expected payload sent as a string over IBC
export interface IbcTransferData {
  amount: string;
  denom: string;
  memo: string;
  receiver: string;
  sender: string;
}

export interface SupportsIbcBridge<P extends PlatformName> {
  getIbcBridge(rpc: RpcConnection<P>): Promise<IbcBridge<P>>;
}

export function supportsIbcBridge<P extends PlatformName>(
  thing: SupportsIbcBridge<P> | any
): thing is SupportsIbcBridge<P> {
  return typeof (<SupportsIbcBridge<P>>thing).getIbcBridge === "function";
}

export interface IbcBridge<P extends PlatformName> {
  //alternative naming: initiateTransfer
  transfer(
    sender: UniversalOrNative<P>,
    recipient: ChainAddress,
    token: UniversalOrNative<P> | "native",
    amount: bigint,
    payload?: Uint8Array
  ): AsyncGenerator<UnsignedTransaction>;

  // cached from config
  //getChannels(): IbcChannel | null;
  //fetchChannels(): Promise<IbcChannel | null>;

  // Get WormholeMessageId for VAAs
  lookupMessageFromIbcMsgId(
    msg: IbcMessageId
  ): Promise<WormholeMessageId>;

  // Get IbcTransferInfo 
  // TODO: overload
  lookupTransferFromTx(txid: TxHash): Promise<IbcTransferInfo>;
  lookupTransferFromIbcMsgId(
    msg: IbcMessageId
  ): Promise<IbcTransferInfo>;
  lookupTransferFromMsg(
    payload: GatewayTransferMsg | GatewayTransferWithPayloadMsg
  ): Promise<IbcTransferInfo>;
}
