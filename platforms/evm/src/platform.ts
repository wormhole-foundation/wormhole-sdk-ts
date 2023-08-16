import {
  Network,
  ChainName,
  ChainId,
  PlatformName,
  toChainName,
} from '@wormhole-foundation/sdk-base';
import {
  TokenId,
  TokenTransferTransaction,
} from '@wormhole-foundation/connect-sdk';
import { EvmContracts } from './contracts';
import { EvmTokenBridge } from './tokenBridge';
import { ethers } from 'ethers';
import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import { Platform, ChainsConfig } from '@wormhole-foundation/connect-sdk';
import { EvmChain } from './chain';
import { EvmAddress } from './address';
import { BridgeStructs } from './ethers-contracts/Bridge';

/**
 * @category EVM
 */
export class EvmPlatform implements Platform {
  // lol
  static readonly _platform: 'Evm' = 'Evm';
  readonly platform: PlatformName = EvmPlatform._platform;

  readonly network: Network;
  readonly conf: ChainsConfig;
  readonly contracts: EvmContracts;

  constructor(network: Network, conf: ChainsConfig) {
    this.network = network;
    this.conf = conf;
    this.contracts = new EvmContracts(network);
  }

  getProvider(chain: ChainName): ethers.Provider {
    const rpcAddress = this.conf[chain]!.rpc;
    return new ethers.JsonRpcProvider(rpcAddress);
  }

  getChain(chain: ChainName): EvmChain {
    return new EvmChain(this, chain);
  }

  async getTokenBridge(provider: ethers.Provider): Promise<EvmTokenBridge> {
    return await EvmTokenBridge.fromProvider(provider);
  }

  async getForeignAsset(
    tokenId: TokenId,
    chain: ChainName,
  ): Promise<UniversalAddress | null> {
    // if the token is already native, return the token address
    if (chain === tokenId[0]) return tokenId[1];

    // else fetch the representation
    // TODO: this uses a brand new provider, not great
    const tokenBridge = await this.getTokenBridge(this.getProvider(chain));
    const foreignAddr = await tokenBridge.getWrappedAsset([chain, tokenId[1]]);
    return foreignAddr.toUniversalAddress();
  }

  async getTokenDecimals(
    tokenAddr: UniversalAddress,
    chain: ChainName,
  ): Promise<bigint> {
    const provider = this.getProvider(chain);
    const tokenContract = this.contracts.mustGetTokenImplementation(
      provider,
      tokenAddr.toString(),
    );
    const decimals = await tokenContract.decimals();
    return decimals;
  }

  async getNativeBalance(
    walletAddr: string,
    chain: ChainName,
  ): Promise<bigint> {
    const provider = this.getProvider(chain);
    return await provider.getBalance(walletAddr);
  }

  async getTokenBalance(
    walletAddr: string,
    tokenId: TokenId,
    chain: ChainName,
  ): Promise<bigint | null> {
    const address = await this.getForeignAsset(tokenId, chain);
    if (!address) return null;

    const provider = this.getProvider(chain);
    const token = this.contracts.mustGetTokenImplementation(
      provider,
      address.toString(),
    );
    const balance = await token.balanceOf(walletAddr);
    return balance;
  }

  parseAddress(address: string): UniversalAddress {
    return new EvmAddress(address).toUniversalAddress();
  }

  async parseMessageFromTx(
    chain: ChainName,
    txid: string,
    rpc: ethers.Provider,
  ): Promise<(TokenTransferTransaction | {})[]> {
    const receipt = await rpc.getTransactionReceipt(txid);
    if (receipt === null) throw new Error('No transaction found');

    const { fee: gasFee } = receipt;

    const core = this.contracts.mustGetCore(chain, rpc);
    const coreAddress = await core.getAddress();

    const bridge = this.contracts.mustGetTokenBridge(chain, rpc);
    const bridgeAddress = new EvmAddress(await bridge.getAddress())
      .toUniversalAddress()
      .toString();

    const bridgeLogs = receipt.logs.filter((l: any) => {
      return l.address === coreAddress;
    });

    const impl = this.contracts.getImplementation();
    const parsedLogs = bridgeLogs.map(async (bridgeLog) => {
      const { topics, data } = bridgeLog;
      const parsed = impl.parseLog({ topics: topics.slice(), data });

      // TODO: should we bail here?
      if (parsed === null) return {};

      // parse token bridge message, 0x01 == transfer, attest == 0x02,  w/ payload 0x03
      let parsedTransfer:
        | BridgeStructs.TransferStructOutput
        | BridgeStructs.TransferWithPayloadStructOutput;

      if (parsed.args.payload.startsWith('0x01')) {
        // parse token bridge transfer data
        parsedTransfer = await bridge.parseTransfer(parsed.args.payload);
      } else if (parsed.args.payload.startsWith('0x03')) {
        // parse token bridge transfer with payload data
        parsedTransfer = await bridge.parseTransferWithPayload(
          parsed.args.payload,
        );
      } else {
        // git gud
        throw new Error(
          `unrecognized payload for ${txid}: ${parsed.args.payload}`,
        );
      }

      const toChain = toChainName(parsedTransfer.toChain);
      const tokenAddress = new UniversalAddress(parsedTransfer.tokenAddress);
      const tokenChain = toChainName(parsedTransfer.tokenChain);

      // TODO: format addresses to universal
      const x: TokenTransferTransaction = {
        sendTx: txid,
        sender: receipt.from,
        amount: parsedTransfer.amount,
        payloadID: parsedTransfer.payloadID,
        toChain: toChain,
        fromChain: chain,
        sequence: parsed.args.sequence,
        block: BigInt(receipt.blockNumber),
        gasFee,
        recipient: parsedTransfer.to,
        tokenId: [tokenChain, tokenAddress],
        emitterAddress: bridgeAddress,
      };
      return x;
    });

    return await Promise.all(parsedLogs);
  }
}
