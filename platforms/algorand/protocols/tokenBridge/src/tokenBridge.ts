import { Network } from '@wormhole-foundation/connect-sdk';
import { ChainId } from '@wormhole-foundation/connect-sdk';
import { TokenBridge } from '@wormhole-foundation/connect-sdk';
import { AlgorandChainName } from '../../../src';
import { Algodv2 } from 'algosdk';
import { Contracts } from '@wormhole-foundation/connect-sdk';
import { toChainId } from '@wormhole-foundation/connect-sdk';

export class AlgorandTokenBridge implements TokenBridge<'Algorand'> {
  readonly chainId: ChainId;
  readonly tokenBridgeAddress: string;
  readonly coreAddress: string;
  readonly tokenBridge: Program<TokenBridgeContract>;

  private constructor(
    readonly network: Network,
    readonly chain: AlgorandChainName,
    readonly connection: Algodv2,
    readonly contracts: Contracts,
  ) {
    this.chainId = toChainId(chain);

    const tokenBridgeAddress = contracts.tokenBridge;
    if (!tokenBridgeAddress) {
      throw new Error(
        `TokenBridge contract address for chain ${chain} not found`,
      );
    }
    this.tokenBridgeAddress = tokenBridgeAddress;

    const coreBridgeAddress = contracts.coreBridge;
    if (!coreBridgeAddress)
      throw new Error(
        `CoreBridge contract address for chain ${chain} not found`,
      );

    this.coreAddress = coreBridgeAddress;

    this.tokenBridge = createReadOnlyTokenBridgeProgramInterface(
      tokenBridgeAddress,
      connection,
    );
  }
}
