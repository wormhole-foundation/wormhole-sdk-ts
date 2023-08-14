import { BigNumber } from 'ethers';
import { TokenId } from '../../src/types';
import { Wormhole } from '../../src/wormhole';
import { MockContracts } from './mockContracts';
import {
  PlatformName,
  ChainName,
  ChainId,
} from '@wormhole-foundation/sdk-base';

export class MockContext1 {
  private type: PlatformName = 'Evm';
  contracts: MockContracts;
  readonly wormhole: Wormhole;

  constructor(wormholeInstance: Wormhole) {
    this.wormhole = wormholeInstance;
    this.contracts = new MockContracts(this.wormhole);
  }

  async startTransfer(
    token: TokenId | 'native',
    amount: bigint,
    sendingChain: ChainName | ChainId,
    senderAddress: string,
    recipientChain: ChainName | ChainId,
    recipientAddress: string,
    relayerFee: any,
  ): Promise<any> {
    return 1;
  }
  async startTransferWithPayload(
    token: TokenId | 'native',
    amount: bigint,
    sendingChain: ChainName | ChainId,
    senderAddress: string,
    recipientChain: ChainName | ChainId,
    recipientAddress: string,
    payload: any,
  ): Promise<any> {
    throw new Error('not implemented');
  }
  formatAddress(address: string): any {
    throw new Error('not implemented');
  }
  parseAddress(address: any): string {
    throw new Error('not implemented');
  }
  async formatAssetAddress(address: string): Promise<any> {
    throw new Error('not implemented');
  }
  async parseAssetAddress(address: any): Promise<string> {
    throw new Error('not implemented');
  }
  async getForeignAsset(
    tokenId: TokenId,
    chain: ChainName | ChainId,
  ): Promise<string | null> {
    throw new Error('not implemented');
  }
  async mustGetForeignAsset(
    tokenId: TokenId,
    chain: ChainName | ChainId,
  ): Promise<string> {
    throw new Error('not implemented');
  }
  async parseMessageFromTx(
    tx: string,
    chain: ChainName | ChainId,
  ): Promise<ParsedMessage[] | ParsedRelayerMessage[]> {
    throw new Error('not implemented');
  }
  async getNativeBalance(
    walletAddress: string,
    chain: ChainName | ChainId,
  ): Promise<BigNumber> {
    throw new Error('not implemented');
  }
  async getTokenBalance(
    walletAddress: string,
    tokenId: TokenId,
    chain: ChainName | ChainId,
  ): Promise<BigNumber | null> {
    throw new Error('not implemented');
  }
  async completeTransfer(
    destChain: ChainName | ChainId,
    signedVAA: Uint8Array,
    overrides: any,
    payerAddr?: any,
  ): Promise<any> {
    throw new Error('not implemented');
  }

  /**
   * Checks if a transfer has been completed or not
   *
   * @param destChain The destination chain name or id
   * @param signedVAA The Signed VAA bytes
   * @returns True if the transfer has been completed, otherwise false
   */
  async isTransferCompleted(
    destChain: ChainName | ChainId,
    signedVaa: string,
  ): Promise<boolean> {
    throw new Error('not implemented');
  }

  async fetchTokenDecimals(
    tokenAddr: string,
    chain: ChainName | ChainId,
  ): Promise<number> {
    throw new Error('not implemented');
  }
}

export class MockContext2 extends MockContext1 {
  constructor(wormholeInstance: Wormhole) {
    super(wormholeInstance);
  }

  async startTransfer(
    token: TokenId | 'native',
    amount: bigint,
    sendingChain: ChainName | ChainId,
    senderAddress: string,
    recipientChain: ChainName | ChainId,
    recipientAddress: string,
    relayerFee: any,
  ): Promise<any> {
    return 2;
  }
}
