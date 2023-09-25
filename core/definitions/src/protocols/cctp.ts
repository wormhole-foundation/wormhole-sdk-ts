import { PlatformName, CircleChainId } from "@wormhole-foundation/sdk-base";
import { UniversalOrNative, ChainAddress } from "../address";
import { CircleMessageId } from "../attestation";
import { UnsignedTransaction } from "../unsignedTransaction";
import { TokenId, TxHash } from "../types";
import "../payloads/connect";
import { RpcConnection } from "../rpc";

// https://github.com/circlefin/evm-cctp-contracts

export interface SupportsCircleBridge<P extends PlatformName> {
  getCircleBridge(rpc: RpcConnection<P>): Promise<CircleBridge<P>>;
}

export function supportsCircleBridge<P extends PlatformName>(
  thing: SupportsCircleBridge<P> | any
): thing is SupportsCircleBridge<P> {
  return typeof (<SupportsCircleBridge<P>>thing).getCircleBridge === "function";
}

export interface SupportsAutomaticCircleBridge<P extends PlatformName> {
  getAutomaticCircleBridge(
    rpc: RpcConnection<P>
  ): Promise<AutomaticCircleBridge<P>>;
}

export function supportsAutomaticCircleBridge<P extends PlatformName>(
  thing: SupportsAutomaticCircleBridge<P> | any
): thing is SupportsAutomaticCircleBridge<P> {
  return (
    typeof (<SupportsAutomaticCircleBridge<P>>thing)
      .getAutomaticCircleBridge === "function"
  );
}

export type CircleTransferDetails = {
  txid: TxHash;
  token: TokenId;
  from: ChainAddress;
  amount: bigint;
  destination: {
    domain: CircleChainId;
    recipient: string;
    tokenMessenger: string;
    caller: string;
  };
  messageId: CircleMessageId;
};

export interface AutomaticCircleBridge<P extends PlatformName> {
  transfer(
    token: ChainAddress,
    sender: UniversalOrNative<P>,
    recipient: ChainAddress,
    amount: bigint,
    nativeGas?: bigint
  ): AsyncGenerator<UnsignedTransaction>;
  // TODO: events
}

export interface CircleBridge<P extends PlatformName> {
  redeem(
    sender: UniversalOrNative<P>,
    message: string,
    attestation: string
  ): AsyncGenerator<UnsignedTransaction>;
  transfer(
    token: ChainAddress,
    sender: UniversalOrNative<P>,
    recipient: ChainAddress,
    amount: bigint
  ): AsyncGenerator<UnsignedTransaction>;
  parseTransactionDetails(txid: string): Promise<CircleTransferDetails>;
}
