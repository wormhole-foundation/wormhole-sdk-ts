import type { Network, Contracts } from '@wormhole-foundation/sdk-connect';
import type { EvmChains } from '@wormhole-foundation/sdk-evm';
import type { Provider } from 'ethers';
import { Contract, getBytes } from 'ethers';

const CCL_ABI = [
  'function getConfiguration(address emitterAddress) external view returns (bytes32)',
];

export interface CCLConfig {
  type: number;
  consistencyLevel: number;
  additionalBlocks: number;
}

export class EvmCustomConsistencyLevel<N extends Network, C extends EvmChains> {
  readonly cclContract: Contract;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: Provider,
    readonly contracts: Contracts,
  ) {
    const cclAddress = contracts.customConsistencyLevel;
    if (!cclAddress)
      throw new Error(
        `Custom Consistency Level contract for ${chain} not found`,
      );

    this.cclContract = new Contract(cclAddress, CCL_ABI, provider);
  }

  async getConfiguration(emitterAddress: string): Promise<CCLConfig> {
    // Type assertion needed because ethers Contract methods are dynamically typed
    const configBytes = await (this.cclContract as any).getConfiguration(
      emitterAddress,
    );
    return decodeAdditionalBlocksConfig(configBytes);
  }
}

export function decodeAdditionalBlocksConfig(config: string): CCLConfig {
  const bytes = getBytes(config);

  if (bytes.length < 4) {
    throw new Error('Invalid configuration: insufficient bytes');
  }

  return {
    type: bytes[0]!,
    consistencyLevel: bytes[1]!,
    additionalBlocks: (bytes[2]! << 8) | bytes[3]!,
  };
}
