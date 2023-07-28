import { BigNumber } from 'ethers';
import { sha3_256 } from 'js-sha3';
import { arrayify, hexlify, stripZeros, zeroPad } from 'ethers/lib/utils';
import { AptosClient, CoinClient, Types } from 'aptos';
import {
  TokenId,
  ParsedRelayerMessage,
  ChainName,
  ChainId,
  NATIVE,
  ParsedMessage,
  Context,
  ParsedRelayerPayload,
  Wormhole,
  hexToUint8Array,
  parseTokenTransferPayload,
  TokenBridgeAbstract,
  MAINNET_CHAINS,
} from '@wormhole-foundation/sdk-base';
import { AptosContracts } from './contracts';
import {
  getForeignAssetAptos,
  getIsTransferCompletedAptos,
  getTypeFromExternalAddress,
  isValidAptosType,
  redeemOnAptos,
  transferFromAptos,
} from './utils';

export const APTOS_COIN = '0x1::aptos_coin::AptosCoin';

/**
 * @category Aptos
 */
export class AptosContext extends TokenBridgeAbstract<Types.EntryFunctionPayload> {
  readonly type = Context.APTOS;
  readonly contracts: AptosContracts;
  protected wormhole: Wormhole;
  readonly aptosClient: AptosClient;
  readonly coinClient: CoinClient;

  constructor(wormholeInstance: Wormhole) {
    super();
    this.wormhole = wormholeInstance;
    const rpc = this.wormhole.conf.rpcs.aptos;
    if (rpc === undefined) throw new Error('No Aptos rpc configured');
    this.aptosClient = new AptosClient(rpc);
    this.coinClient = new CoinClient(this.aptosClient);
    this.contracts = new AptosContracts(this.wormhole, this.aptosClient);
  }

  async startTransfer(
    token: TokenId | typeof NATIVE,
    amount: bigint,
    sendingChain: ChainName | ChainId,
    senderAddress: string,
    recipientChain: ChainName | ChainId,
    recipientAddress: string,
    relayerFee: string = '0',
  ): Promise<Types.EntryFunctionPayload> {
    const destContext = this.wormhole.getContext(recipientChain);
    const recipientChainId = this.wormhole.toChainId(recipientChain);

    let recipientAccount = recipientAddress;
    // get token account for solana
    if (recipientChainId === MAINNET_CHAINS.solana) {
      let tokenId = token;
      if (token === NATIVE) {
        tokenId = {
          address: APTOS_COIN,
          chain: 'aptos',
        };
      }
      recipientAccount = await this.wormhole.getSolanaRecipientAddress(
        recipientChain,
        tokenId as TokenId,
        recipientAddress,
      );
    }
    const formattedRecipientAccount = arrayify(
      destContext.formatAddress(recipientAccount),
    );

    let coinType;
    if (token === NATIVE) {
      coinType = APTOS_COIN;
    } else {
      coinType = await this.mustGetForeignAsset(token, sendingChain);
    }

    const payload = transferFromAptos(
      this.contracts.mustGetBridge(sendingChain),
      coinType,
      amount.toString(),
      recipientChainId,
      formattedRecipientAccount,
      relayerFee,
      undefined,
    );
    return payload;
  }

  async startTransferWithPayload(
    token: TokenId | typeof NATIVE,
    amount: bigint,
    sendingChain: ChainName | ChainId,
    senderAddress: string,
    recipientChain: ChainName | ChainId,
    recipientAddress: string,
    payload: any,
  ): Promise<Types.EntryFunctionPayload> {
    throw new Error('Aptos send with payload not implemented');
  }

  formatAddress(address: string): Uint8Array {
    return arrayify(zeroPad(address, 32));
  }

  parseAddress(address: string): string {
    return hexlify(stripZeros(address));
  }

  async formatAssetAddress(address: string): Promise<Uint8Array> {
    if (!isValidAptosType(address)) {
      throw new Error(`Unable to format Aptos asset address: ${address}`);
    }
    return hexToUint8Array(sha3_256(address));
  }

  async parseAssetAddress(address: string): Promise<string> {
    const bridge = this.contracts.mustGetBridge('aptos');
    const assetType = await getTypeFromExternalAddress(
      this.aptosClient,
      bridge,
      address,
    );
    if (!assetType)
      throw new Error(`Unable to parse Aptos asset address: ${address}`);
    return assetType;
  }

  async getForeignAsset(
    tokenId: TokenId,
    chain: ChainName | ChainId,
  ): Promise<string | null> {
    const chainId = this.wormhole.toChainId(tokenId.chain);
    const toChainId = this.wormhole.toChainId(chain);
    if (toChainId === chainId) return tokenId.address;

    const { token_bridge } = this.wormhole.mustGetContracts(chain);
    if (!token_bridge) throw new Error('token bridge contract not found');

    const tokenContext = this.wormhole.getContext(tokenId.chain);
    const formattedAddr = await tokenContext.formatAssetAddress(
      tokenId.address,
    );
    return await getForeignAssetAptos(
      this.aptosClient,
      token_bridge,
      chainId,
      hexlify(formattedAddr),
    );
  }

  async mustGetForeignAsset(
    tokenId: TokenId,
    chain: ChainName | ChainId,
  ): Promise<string> {
    const addr = await this.getForeignAsset(tokenId, chain);
    if (!addr) throw new Error('token not registered');
    return addr;
  }

  async fetchTokenDecimals(
    tokenAddr: string,
    chain: ChainName | ChainId,
  ): Promise<number> {
    const coinType = `0x1::coin::CoinInfo<${tokenAddr}>`;
    const decimals = (
      (
        await this.aptosClient.getAccountResource(
          tokenAddr.split('::')[0],
          coinType,
        )
      ).data as any
    ).decimals;
    return decimals;
  }

  async parseMessageFromTx(
    tx: string,
    chain: ChainName | ChainId,
  ): Promise<ParsedMessage[] | ParsedRelayerMessage[]> {
    const transaction = await this.aptosClient.getTransactionByHash(tx);
    if (transaction.type !== 'user_transaction') {
      throw new Error(`${tx} is not a user_transaction`);
    }
    const userTransaction = transaction as Types.UserTransaction;
    const message = userTransaction.events.find((event) =>
      event.type.endsWith('WormholeMessage'),
    );
    if (!message || !message.data) {
      throw new Error(`WormholeMessage not found for ${tx}`);
    }
    const { payload, sender, sequence } = message.data;
    const parsed = parseTokenTransferPayload(
      Buffer.from(payload.slice(2), 'hex'),
    );
    const tokenContext = this.wormhole.getContext(parsed.tokenChain as ChainId);
    const destContext = this.wormhole.getContext(parsed.toChain as ChainId);
    const tokenAddress = await tokenContext.parseAssetAddress(
      hexlify(parsed.tokenAddress),
    );
    const tokenChain = this.wormhole.toChainName(parsed.tokenChain);
    // make sender address even-length
    const emitter = hexlify(sender, {
      allowMissingPrefix: true,
      hexPad: 'left',
    });
    const parsedMessage: ParsedMessage = {
      sendTx: tx,
      sender: userTransaction.sender,
      amount: BigNumber.from(parsed.amount),
      payloadID: Number(parsed.payloadType),
      recipient: destContext.parseAddress(hexlify(parsed.to)),
      toChain: this.wormhole.toChainName(parsed.toChain),
      fromChain: this.wormhole.toChainName(chain),
      tokenAddress,
      tokenChain,
      tokenId: {
        chain: tokenChain,
        address: tokenAddress,
      },
      sequence: BigNumber.from(sequence),
      emitterAddress: hexlify(this.formatAddress(emitter)),
      block: Number(userTransaction.version),
      gasFee: BigNumber.from(userTransaction.gas_used).mul(
        userTransaction.gas_unit_price,
      ),
    };
    return [parsedMessage];
  }

  async getNativeBalance(
    walletAddress: string,
    chain: ChainName | ChainId,
  ): Promise<BigNumber> {
    return await this.checkBalance(walletAddress, APTOS_COIN);
  }

  async getTokenBalance(
    walletAddress: string,
    tokenId: TokenId,
    chain: ChainName | ChainId,
  ): Promise<BigNumber | null> {
    const address = await this.getForeignAsset(tokenId, chain);
    if (!address) return null;
    const balance = await this.checkBalance(walletAddress, address);
    return balance ? BigNumber.from(balance) : null;
  }

  async checkBalance(
    walletAddress: string,
    coinType: string,
  ): Promise<BigNumber> {
    try {
      const balance = await this.coinClient.checkBalance(walletAddress, {
        coinType,
      });
      return BigNumber.from(balance);
    } catch (e: any) {
      if (
        (e instanceof Types.ApiError || e.errorCode === 'resource_not_found') &&
        e.status === 404
      ) {
        return BigNumber.from(0);
      }
      throw e;
    }
  }

  async completeTransfer(
    destChain: ChainName | ChainId,
    signedVAA: Uint8Array,
    overrides: any,
    payerAddr?: any,
  ): Promise<Types.EntryFunctionPayload> {
    const payload = await redeemOnAptos(
      this.aptosClient,
      this.contracts.mustGetBridge(destChain),
      signedVAA,
    );
    return payload;
  }

  async isTransferCompleted(
    destChain: ChainName | ChainId,
    signedVaa: string,
  ): Promise<boolean> {
    return await getIsTransferCompletedAptos(
      this.aptosClient,
      this.contracts.mustGetBridge(destChain),
      arrayify(signedVaa),
    );
  }

  getTxIdFromReceipt(hash: Types.HexEncodedBytes) {
    return hash;
  }

  parseRelayerPayload(payload: Buffer): ParsedRelayerPayload {
    throw new Error('relaying is not supported on aptos');
  }

  async getCurrentBlock(): Promise<number> {
    throw new Error('Aptos getCurrentBlock not implemented');
  }
}
