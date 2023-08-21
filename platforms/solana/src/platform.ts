import {
  Connection,
  PublicKey,
  PublicKeyInitData,
} from '@solana/web3.js';
import {
  ChainName,
  ChainId,
  toChainId,
  toChainName,
  PlatformName,
  Network,
} from '@wormhole-foundation/sdk-base';
import {
  CONFIG,
  Platform,
  TokenId,
  TokenTransferTransaction,
  ChainsConfig,
  getPlatform,
  registerPlatform,
  ChainContext,
} from '@wormhole-foundation/connect-sdk';

import { SolanaContracts } from './contracts';
import {
  deriveWormholeEmitterKey,
  getPostedMessage,
} from './utils/wormhole';
import {
  getForeignAssetSolana,
} from './utils';
import { hexByteStringToUint8Array, uint8ArrayToHexByteString } from '@wormhole-foundation/sdk-base';
import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import { SolanaAddress } from './address';
import { parseTokenTransferPayload } from '@certusone/wormhole-sdk';
import { SolanaChain } from './chain';

const SOLANA_SEQ_LOG = 'Program log: Sequence: ';
const SOLANA_CHAIN_NAME = CONFIG['Mainnet'].chains.Solana!.key;

const sharedEmitter =
  '3b26409f8aaded3f5ddca184695aa6a0fa829b0c85caf84856324896d214ca98';
const SOLANA_EMMITER_ID = {
  Mainnet: 'ec7372995d5cc8732397fb0ad35c0121e0eaa90d26f828a534cab54391b3a4f5',
  Testnet: sharedEmitter,
  Devnet: sharedEmitter,
};

/**
 * @category Solana
 */
export class SolanaPlatform implements Platform {
  public static platform: PlatformName = 'Solana';

  readonly network: Network;
  readonly conf: ChainsConfig;
  readonly contracts: SolanaContracts;

  connection: Connection | undefined;

  constructor(network: Network, conf: ChainsConfig) {
    this.network = network;
    this.conf = conf;
    this.contracts = new SolanaContracts(network);
  }

  /**
   * Sets the Connection
   *
   * @param connection The Solana Connection
   */
  async setConnection(connection: Connection) {
    this.connection = connection;
  }

  // TODO: Fix once SolanaChain is implemented
  getChain(chain: ChainName): ChainContext {
    return (new SolanaChain(this, chain)) as unknown as ChainContext;
  }

  async getTokenDecimals(
    tokenAddr: UniversalAddress,
    chain?: ChainName,
  ): Promise<bigint> {
    if (!this.connection) throw new Error('no connection');
    let mint = await this.connection.getParsedAccountInfo(
      new PublicKey(tokenAddr),
    );
    if (!mint) throw new Error('could not fetch token details');
    const { decimals } = (mint as any).value.data.parsed.info;
    return decimals;
  }

  async getNativeBalance(
    walletAddr: string,
    chain: ChainName,
  ): Promise<bigint> {
    if (!this.connection) throw new Error('no connection');
    const balance = await this.connection.getBalance(
      new PublicKey(walletAddr),
    );
    return BigInt(balance);
  }

  async getTokenBalance(
    walletAddress: string,
    tokenId: TokenId,
    chain: ChainName,
  ): Promise<bigint | null> {
    if (!this.connection) throw new Error('no connection');
    const address = await this.getForeignAsset(tokenId, chain);
    if (!address) return null;
    const splToken = await this.connection.getTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { mint: new PublicKey(address) },
    );
    if (!splToken.value[0]) return null;
    const balance = await this.connection.getTokenAccountBalance(
      splToken.value[0].pubkey,
    );

    return BigInt(balance.value.amount);
  }

  formatAddress(address: PublicKeyInitData): Uint8Array {
    const addr =
      typeof address === 'string' && address.startsWith('0x')
        ? hexByteStringToUint8Array(address)
        : address;
    return new PublicKey(addr).toBytes();
  }

  parseAddress(address: string): UniversalAddress {
    return new UniversalAddress(new PublicKey(address).toBytes());
  }

  async getForeignAsset(
    tokenId: TokenId,
    chain: ChainName,
  ): Promise<UniversalAddress | null> {
    if (!this.connection) throw new Error('no connection');

    const chainId = toChainId(tokenId[0]);
    const destChainId = toChainId(chain);
    if (destChainId === chainId) return tokenId[1];

    const contracts = this.contracts.mustGetContracts(chain);
    if (!contracts.TokenBridge) throw new Error('contracts not found');

    const addr = await getForeignAssetSolana(
      this.connection,
      contracts.TokenBridge,
      chainId,
      tokenId[1].unwrap(),
    );
    if (!addr) return null;
    return new SolanaAddress(addr).toUniversalAddress();
  }

  async parseMessageFromTx(
    chain: ChainName | ChainId,
    tx: string,
  ): Promise<TokenTransferTransaction[]> {
    if (!this.connection) throw new Error('no connection');
    const contracts = this.contracts.mustGetContracts(SOLANA_CHAIN_NAME);
    if (!contracts.CoreBridge || !contracts.TokenBridge)
      throw new Error('contracts not found');
    const response = await this.connection.getTransaction(tx);
    const parsedResponse = await this.connection.getParsedTransaction(tx);
    if (!response || !response.meta?.innerInstructions![0].instructions)
      throw new Error('transaction not found');

    const instructions = response.meta?.innerInstructions![0].instructions;
    const accounts = response.transaction.message.accountKeys;

    // find the instruction where the programId equals the Wormhole ProgramId and the emitter equals the Token Bridge
    const bridgeInstructions = instructions.filter((i) => {
      const programId = accounts[i.programIdIndex].toString();
      const emitterId = accounts[i.accounts[2]];
      const wormholeCore = contracts.CoreBridge;
      const tokenBridge = deriveWormholeEmitterKey(contracts.TokenBridge!);
      return programId === wormholeCore && emitterId.equals(tokenBridge);
    });
    const { message } = await getPostedMessage(
      this.connection,
      accounts[bridgeInstructions[0].accounts[1]],
    );

    const parsedInstr =
      parsedResponse?.meta?.innerInstructions![0].instructions;
    const gasFee = parsedInstr
      ? parsedInstr.reduce((acc, c: any) => {
          if (!c.parsed || !c.parsed.info || !c.parsed.info.lamports)
            return acc;
          return acc + c.parsed.info.lamports;
        }, 0)
      : 0;

    // parse message payload
    const parsed = parseTokenTransferPayload(message.payload);

    // get sequence
    const sequence = response.meta?.logMessages
      ?.filter((msg) => msg.startsWith(SOLANA_SEQ_LOG))?.[0]
      ?.replace(SOLANA_SEQ_LOG, '');
    if (!sequence) {
      throw new Error('sequence not found');
    }

    // format response
    const destPlatform = getPlatform(toChainName(parsed.toChain));

    const tokenAddress = new UniversalAddress(parsed.tokenAddress);
    const tokenChain = toChainName(parsed.tokenChain);

    const toAddress = (destPlatform as Platform).parseAddress(uint8ArrayToHexByteString(parsed.to));

    const parsedMessage: TokenTransferTransaction = {
      sendTx: tx,
      sender: accounts[0].toString(),
      amount: BigInt(parsed.amount),
      payloadID: BigInt(parsed.payloadType),
      recipient: toAddress.toString(),
      toChain: toChainName(parsed.toChain),
      fromChain: toChainName(chain),
      tokenId: [
        toChainName(tokenChain),
        tokenAddress,
      ],
      sequence: BigInt(sequence),
      emitterAddress: SOLANA_EMMITER_ID[this.network],
      gasFee: BigInt(gasFee),
      block: BigInt(response.slot),
    };

    if (parsedMessage.payloadID === BigInt(3)) {
      // TODO:
      // const destContext = this.wormhole.getPlatform(toChainName(parsed.toChain));
      // const parsedPayload = destContext.parseRelayerPayload(
      //   parsed.tokenTransferPayload,
      // );
      // const parsedPayloadMessage: ParsedRelayerMessage = {
      //   ...parsedMessage,
      //   relayerPayloadId: parsedPayload.relayerPayloadId,
      //   recipient: destContext.parseAddress(parsedPayload.to),
      //   to: toAddress,
      //   relayerFee: parsedPayload.relayerFee,
      //   toNativeTokenAmount: parsedPayload.toNativeTokenAmount,
      // };
      // return [parsedPayloadMessage];
    }

    return [parsedMessage];
  }
}

registerPlatform('Solana', SolanaPlatform);
