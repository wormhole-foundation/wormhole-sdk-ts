import { ChainName, PlatformName } from "@wormhole-foundation/sdk-base";
import { UniversalOrNative, ChainAddress } from "../address";
import { UnsignedTransaction } from "../unsignedTransaction";

//https://github.com/circlefin/evm-cctp-contracts

export interface WormholeCircleRelayer<P extends PlatformName> {
  transfer(
    token: ChainAddress,
    sender: UniversalOrNative<P>,
    recipient: ChainAddress,
    amount: bigint,
    nativeGas?: bigint
  ): AsyncGenerator<UnsignedTransaction>;
}

// TODO: Genericize to support other platforms
export type CCTPInfo = {
  fromChain: ChainName;
  txid: string;
  block: bigint;
  gasUsed: string;
  depositor: string;
  amount: bigint;
  destination: {
    domain: number;
    recipient: string;
    tokenMessenger: string;
    caller: string;
  };
  message: string;
  messageHash: Uint8Array;
};

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
  parseTransactionDetails(txid: string): Promise<CCTPInfo>;
}
