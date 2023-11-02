import { Chain, PlatformName } from "@wormhole-foundation/sdk-base";
import { AnyAddress } from "./types";

export interface Relayer<P extends PlatformName> {
  relaySupported(chain: Chain): boolean;
  getRelayerFee(sourceChain: Chain, destChain: Chain, tokenId: AnyAddress): Promise<bigint>;
  // TODO: What should this be named?
  // I don't think it should return an UnisgnedTransaction
  // rather it should take some signing callbacks and
  // a ref to track the progress
  startTransferWithRelay(
    token: AnyAddress,
    amount: bigint,
    toNativeToken: string,
    sendingChain: Chain,
    senderAddress: string,
    recipientChain: Chain,
    recipientAddress: string,
    overrides?: any,
  ): Promise<any>;
  calculateNativeTokenAmt(
    destChain: Chain,
    tokenId: AnyAddress,
    amount: bigint,
    walletAddress: string,
  ): Promise<bigint>;
  calculateMaxSwapAmount(
    destChain: Chain,
    tokenId: AnyAddress,
    walletAddress: string,
  ): Promise<bigint>;
}
