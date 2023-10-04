import { ChainId, PlatformName } from "@wormhole-foundation/sdk-base";
import { UniversalOrNative, ChainAddress } from "../address";
import { UnsignedTransaction } from "../unsignedTransaction";
import { RpcConnection } from "../rpc";
import { TokenId } from "../types";

// GatewayTransferMsg is the message sent in the payload of a TokenTransfer
// to be executed by the Gateway contract.
export interface GatewayTransferMsg {
  gateway_transfer: {
    chain: ChainId;
    recipient: string;
    fee: string;
    nonce: number;
  };
}

export function isGatewayTransferMsg(
  thing: GatewayTransferMsg | any
): thing is GatewayTransferMsg {
  return (<GatewayTransferMsg>thing).gateway_transfer !== undefined;
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

export function isGatewayTransferWithPayloadMsg(
  thing: GatewayTransferWithPayloadMsg | any
): thing is GatewayTransferWithPayloadMsg {
  return (
    (<GatewayTransferWithPayloadMsg>thing).gateway_transfer_with_payload !==
    undefined
  );
}

export type GatewayTransferDetails = {
  token: TokenId | "native";
  amount: bigint;
  from: ChainAddress;
  to: ChainAddress;
  payload?: Uint8Array;
  nativeGas?: bigint;
};

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

// Summary of an IBCTransfer with the message
// payload and a pending flag if we find it
// in the PendingCommitment queue
export interface IBCTransferInfo {
  sequence: number;
  srcChan: string;
  dstChan: string;
  pending: boolean;
  data: IBCTransferData;
}

// The expected payload sent as a string over IBC
export interface IBCTransferData {
  amount: string;
  denom: string;
  memo: string;
  receiver: string;
  sender: string;
}

// GatewayIBCTransferMsg is the message sent in the memo of an IBC transfer
// to be decoded and executed by the Gateway contract.
export interface GatewayIbcTransferMsg {
  gateway_ibc_token_bridge_payload: GatewayTransferMsg;
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

  lookupTransfer(
    payload: GatewayTransferMsg | GatewayTransferWithPayloadMsg
  ): Promise<IBCTransferInfo>;
}
