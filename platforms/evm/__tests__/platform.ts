import type { Provider, TransactionReceipt, TransactionResponse } from 'ethers';
import { EvmPlatform } from '@wormhole-foundation/sdk-evm';

function mockProvider(overrides: Partial<Provider> = {}): Provider {
  return overrides as unknown as Provider;
}

describe('EvmPlatform', () => {
  describe('CHAINS_WITH_CUSTOM_TX_TYPES', () => {
    it('includes Celo and Tempo', () => {
      expect(EvmPlatform.CHAINS_WITH_CUSTOM_TX_TYPES.has('Celo')).toBe(true);
      expect(EvmPlatform.CHAINS_WITH_CUSTOM_TX_TYPES.has('Tempo')).toBe(true);
    });

    it('does not include standard chains', () => {
      expect(EvmPlatform.CHAINS_WITH_CUSTOM_TX_TYPES.has('Ethereum')).toBe(
        false,
      );
    });
  });

  describe('sendWait', () => {
    const TX_HASH = '0xabcdef1234567890';

    it('uses txRes.wait() for standard chains', async () => {
      const receipt = { status: 1 } as TransactionReceipt;
      const waitFn = jest.fn().mockResolvedValue(receipt);
      const rpc = mockProvider({
        broadcastTransaction: jest.fn().mockResolvedValue({
          hash: TX_HASH,
          wait: waitFn,
        } as unknown as TransactionResponse),
        waitForTransaction: jest.fn(),
      });

      const result = await EvmPlatform.sendWait(
        'Ethereum' as any,
        rpc,
        ['0xsignedtx'],
      );

      expect(result).toEqual([TX_HASH]);
      expect(waitFn).toHaveBeenCalled();
      expect(rpc.waitForTransaction).not.toHaveBeenCalled();
    });

    it('uses waitForTransaction for Tempo', async () => {
      const receipt = { status: 1 } as TransactionReceipt;
      const rpc = mockProvider({
        broadcastTransaction: jest.fn().mockResolvedValue({
          hash: TX_HASH,
        } as unknown as TransactionResponse),
        waitForTransaction: jest.fn().mockResolvedValue(receipt),
      });

      const result = await EvmPlatform.sendWait(
        'Tempo' as any,
        rpc,
        ['0xsignedtx'],
      );

      expect(result).toEqual([TX_HASH]);
      expect(rpc.waitForTransaction).toHaveBeenCalledWith(
        TX_HASH,
        1,
        120_000,
      );
    });

    it('uses waitForTransaction for Celo', async () => {
      const receipt = { status: 1 } as TransactionReceipt;
      const rpc = mockProvider({
        broadcastTransaction: jest.fn().mockResolvedValue({
          hash: TX_HASH,
        } as unknown as TransactionResponse),
        waitForTransaction: jest.fn().mockResolvedValue(receipt),
      });

      const result = await EvmPlatform.sendWait(
        'Celo' as any,
        rpc,
        ['0xsignedtx'],
      );

      expect(result).toEqual([TX_HASH]);
      expect(rpc.waitForTransaction).toHaveBeenCalledWith(
        TX_HASH,
        1,
        120_000,
      );
    });

    it('throws on timeout (waitForTransaction returns null)', async () => {
      const rpc = mockProvider({
        broadcastTransaction: jest.fn().mockResolvedValue({
          hash: TX_HASH,
        } as unknown as TransactionResponse),
        waitForTransaction: jest.fn().mockResolvedValue(null),
      });

      await expect(
        EvmPlatform.sendWait('Tempo' as any, rpc, ['0xsignedtx']),
      ).rejects.toThrow('Transaction was not mined within');
    });

    it('throws when receipt.status is 0 (reverted)', async () => {
      const rpc = mockProvider({
        broadcastTransaction: jest.fn().mockResolvedValue({
          hash: TX_HASH,
        } as unknown as TransactionResponse),
        waitForTransaction: jest
          .fn()
          .mockResolvedValue({ status: 0 } as TransactionReceipt),
      });

      await expect(
        EvmPlatform.sendWait('Tempo' as any, rpc, ['0xsignedtx']),
      ).rejects.toThrow('Transaction reverted: 0xabcdef1234567890');
    });

    it('throws when receipt.status is null (pre-Byzantium)', async () => {
      const rpc = mockProvider({
        broadcastTransaction: jest.fn().mockResolvedValue({
          hash: TX_HASH,
        } as unknown as TransactionResponse),
        waitForTransaction: jest
          .fn()
          .mockResolvedValue({ status: null } as unknown as TransactionReceipt),
      });

      await expect(
        EvmPlatform.sendWait('Tempo' as any, rpc, ['0xsignedtx']),
      ).rejects.toThrow('Transaction reverted: 0xabcdef1234567890');
    });

    it('returns multiple tx hashes for multiple transactions', async () => {
      const hashes = ['0xhash1', '0xhash2'];
      let callCount = 0;
      const rpc = mockProvider({
        broadcastTransaction: jest.fn().mockImplementation(() => {
          const hash = hashes[callCount++];
          return Promise.resolve({
            hash,
            wait: jest
              .fn()
              .mockResolvedValue({ status: 1 } as TransactionReceipt),
          } as unknown as TransactionResponse);
        }),
      });

      const result = await EvmPlatform.sendWait(
        'Ethereum' as any,
        rpc,
        ['0xtx1', '0xtx2'],
      );

      expect(result).toEqual(hashes);
    });

    it('throws when txRes.wait() returns null on standard chain', async () => {
      const rpc = mockProvider({
        broadcastTransaction: jest.fn().mockResolvedValue({
          hash: TX_HASH,
          wait: jest.fn().mockResolvedValue(null),
        } as unknown as TransactionResponse),
      });

      await expect(
        EvmPlatform.sendWait('Ethereum' as any, rpc, ['0xsignedtx']),
      ).rejects.toThrow('Received null TxReceipt');
    });
  });
});
