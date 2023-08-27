import { PlatformName } from "@wormhole-foundation/sdk-base";
import { UniversalOrNative, ChainAddress } from "../address";
import { CircleMessageId } from "../attestation";
import { UnsignedTransaction } from "../unsignedTransaction";
import { TxHash } from "../types";

// https://github.com/circlefin/evm-cctp-contracts

// TODO: Genericize to support other platforms
export type CircleTransferDetails = {
  txid: TxHash;
  from: ChainAddress;
  amount: bigint;
  destination: {
    domain: number;
    recipient: string;
    tokenMessenger: string;
    caller: string;
  };
  messageId: CircleMessageId;
};

export interface WormholeCircleRelayer<P extends PlatformName> {
  transfer(
    token: ChainAddress,
    sender: UniversalOrNative<P>,
    recipient: ChainAddress,
    amount: bigint,
    nativeGas?: bigint
  ): AsyncGenerator<UnsignedTransaction>;
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
