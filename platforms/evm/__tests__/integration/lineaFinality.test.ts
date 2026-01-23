import { describe, expect, test } from '@jest/globals';
import { JsonRpcProvider } from 'ethers';
import {
  finalityThreshold,
  blockTime,
  contracts,
} from '@wormhole-foundation/sdk-base';
import {
  EvmCustomConsistencyLevel,
  decodeAdditionalBlocksConfig,
} from '../../protocols/customConsistencyLevel/src/index.js';

describe('Linea Finality Tests', () => {
  const SEPOLIA_LINEA_RPC = 'https://rpc.sepolia.linea.build';
  const TRANSCEIVER = '0xaceE91e84463b1F11C6CaA064455E5B65F9dCE91';

  test('should have Linea in finality thresholds', () => {
    expect(finalityThreshold('Linea')).toBe(10);
  });

  test('should have Linea block time', () => {
    expect(blockTime('Linea')).toBe(2_000);
  });

  test('should decode configuration bytes correctly', () => {
    // Test with actual transceiver configuration: 0x01c8000500000000000000000000000000000000000000000000000000000000
    // Should decode to: type=1, consistencyLevel=200 (0xc8), additionalBlocks=5 (0x0005)
    const actualConfig =
      '0x01c8000500000000000000000000000000000000000000000000000000000000';
    const decoded = decodeAdditionalBlocksConfig(actualConfig);

    expect(decoded.type).toBe(1);
    expect(decoded.consistencyLevel).toBe(200);
    expect(decoded.additionalBlocks).toBe(5);
  });

  // NOTE: This test validates the base assumption before proceeding with implementation
  test('should query CCL contract configuration', async () => {
    const provider = new JsonRpcProvider(SEPOLIA_LINEA_RPC);
    const cclAddress = contracts.customConsistencyLevel.get('Testnet', 'Linea');

    if (!cclAddress) {
      throw new Error('CCL contract address not found for Testnet Linea');
    }

    const contractsObj = {
      customConsistencyLevel: cclAddress,
    };

    const ccl = new EvmCustomConsistencyLevel(
      'Testnet',
      'Linea',
      provider,
      contractsObj,
    );

    const config = await ccl.getConfiguration(TRANSCEIVER);

    expect(config.type).toBe(1); // TYPE_ADDITIONAL_BLOCKS
    expect(config.consistencyLevel).toBe(200);
    expect(config.additionalBlocks).toBe(5);
  }, 30000); // 30 second timeout for network call

  test('should handle invalid configuration bytes', () => {
    const invalidConfig = '0x01'; // Too short

    expect(() => decodeAdditionalBlocksConfig(invalidConfig)).toThrow(
      'Invalid configuration: insufficient bytes',
    );
  });
});
