import { ethers } from 'ethers';
import {
  Network,
  ChainName,
  PlatformName,
  toChainName,
  ChainId,
  toChainId,
} from '@wormhole-foundation/sdk-base';
import {
  TokenId,
  TokenTransferTransaction,
  TxHash,
  registerPlatform,
  Platform,
  ChainsConfig,
  TokenBridge,
  UniversalAddress,
} from '@wormhole-foundation/sdk-definitions';
import { EvmContracts } from './contracts';
import { EvmTokenBridge } from './tokenBridge';
import { EvmChain } from './chain';
import { EvmAddress } from './address';
import { BridgeStructs } from './ethers-contracts/Bridge';

/**
 * @category EVM
 */
export class EvmPlatform implements Platform {
  public static platform: PlatformName = 'Evm';

  readonly network: Network;
  readonly conf: ChainsConfig;
  readonly contracts: EvmContracts;

  constructor(network: Network, conf: ChainsConfig) {
    this.network = network;
    this.conf = conf;
    this.contracts = new EvmContracts(network);
  }

  setConnection(chain: ChainName, rpc: string) {
    // TODO: add getConnection
  }

  getConnection(chain: ChainName): ethers.Provider {
    const rpcAddress = this.conf[chain]!.rpc;
    return new ethers.JsonRpcProvider(rpcAddress);
  }

  getChain(chain: ChainName): EvmChain {
    return new EvmChain(this, chain);
  }

  async getTokenBridge(chain: ChainName): Promise<TokenBridge<'Evm'>> {
    const rpc = this.getConnection(chain);
    return await EvmTokenBridge.fromProvider(rpc);
  }

  async getForeignAsset(
    chain: ChainName,
    tokenId: TokenId,
  ): Promise<UniversalAddress | null> {
    const rpc = this.getConnection(chain);
    // if the token is already native, return the token address
    if (chain === tokenId.chain) return tokenId.address;

    const tokenBridge = await this.getTokenBridge(chain);
    const foreignAddr = await tokenBridge.getWrappedAsset({
      chain,
      address: tokenId.address,
    });
    return foreignAddr.toUniversalAddress();
  }

  async getTokenDecimals(
    chain: ChainName,
    tokenAddr: UniversalAddress,
  ): Promise<bigint> {
    const rpc = this.getConnection(chain);
    const tokenContract = this.contracts.mustGetTokenImplementation(
      rpc,
      tokenAddr.toString(),
    );
    const decimals = await tokenContract.decimals();
    return decimals;
  }

  async getNativeBalance(
    chain: ChainName,
    walletAddr: string,
  ): Promise<bigint> {
    const rpc = this.getConnection(chain);
    return await rpc.getBalance(walletAddr);
  }

  async getTokenBalance(
    chain: ChainName,
    walletAddr: string,
    tokenId: TokenId,
  ): Promise<bigint | null> {
    const rpc = this.getConnection(chain);
    const address = await this.getForeignAsset(chain, tokenId);
    if (!address) return null;

    const token = this.contracts.mustGetTokenImplementation(
      rpc,
      address.toString(),
    );
    const balance = await token.balanceOf(walletAddr);
    return balance;
  }

  parseAddress(address: string): UniversalAddress {
    // 42 is 20 bytes as hex + 2 bytes for 0x
    if (address.length > 42) {
      return new UniversalAddress(address);
    }
    return new EvmAddress(address).toUniversalAddress();
  }

  async parseTransaction(
    chain: ChainName,
    txid: TxHash,
  ): Promise<TokenTransferTransaction[]> {
    const rpc = this.getConnection(chain);
    const receipt = await rpc.getTransactionReceipt(txid);
    if (receipt === null)
      throw new Error(`No transaction found with txid: ${txid}`);

    const { fee: gasFee } = receipt;

    const core = this.contracts.mustGetCore(chain, rpc);
    const coreAddress = await core.getAddress();

    const bridge = this.contracts.mustGetTokenBridge(chain, rpc);
    const bridgeAddress = new EvmAddress(
      await bridge.getAddress(),
    ).toUniversalAddress();

    const bridgeLogs = receipt.logs.filter((l: any) => {
      return l.address === coreAddress;
    });

    const impl = this.contracts.getImplementation();
    const parsedLogs = bridgeLogs.map(async (bridgeLog) => {
      const { topics, data } = bridgeLog;
      const parsed = impl.parseLog({ topics: topics.slice(), data });

      // TODO: should we be nicer here?
      if (parsed === null) throw new Error(`Failed to parse logs: ${data}`);

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

      const ttt: TokenTransferTransaction = {
        message: {
          tx: { chain: chain, txid },
          msgId: {
            chain: toChainId(toChain),
            emitterAddress: bridgeAddress,
            sequence: parsed.args.sequence,
          },
          payloadId: parsedTransfer.payloadID,
        },
        details: {
          token: { chain: tokenChain, address: tokenAddress },
          amount: parsedTransfer.amount,
          from: { chain, address: this.parseAddress(receipt.from) },
          to: {
            chain: toChain,
            address: new UniversalAddress(parsedTransfer.to),
          },
        },
        block: BigInt(receipt.blockNumber),
        gasFee,
      };
      return ttt;
    });

    return await Promise.all(parsedLogs);
  }
}

declare global {
  namespace Wormhole {
    interface PlatformMapping {
      Evm: EvmPlatform;
    }
  }
}

registerPlatform('Evm', EvmPlatform);
