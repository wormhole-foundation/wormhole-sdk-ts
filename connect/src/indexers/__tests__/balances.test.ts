import { getWalletBalances } from "../balances.js";

describe("balances", () => {
  // Mock global fetch
  global.fetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe("getWalletBalances()", () => {
    const walletAddr = "0x1234567890123456789012345678901234567890";
    const network = "Mainnet";
    const chain = "Ethereum";

    it("should throw error when no indexers provided", async () => {
      await expect(getWalletBalances(walletAddr, network, chain)).rejects.toThrow(
        `Can't get balances without an indexer.`,
      );
    });

    it("should return balances from GoldRush indexer", async () => {
      const mockGoldRushResponse = {
        data: {
          items: [
            { contract_address: "0xToken1", balance: "100" },
            { contract_address: "0xToken2", balance: "200" },
            {
              contract_address: "0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
              balance: "1000",
            },
            { contract_address: "0xToken3", balance: "invalid" }, // invalid balance
            { contract_address: "0xToken4" }, // missing balance
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(mockGoldRushResponse),
      });

      const result = await getWalletBalances(walletAddr, network, chain, {
        goldRush: { apiKey: "test-key", timeoutMs: 100 },
      });

      expect(result).toEqual({
        "0xtoken1": 100n,
        "0xtoken2": 200n,
        native: 1000n,
      });
      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.covalenthq.com/v1/eth-mainnet/address/${walletAddr}/balances_v2/?key=test-key`,
        { signal: expect.any(AbortSignal) },
      );
    });

    it("should fallback to Alchemy when GoldRush fails", async () => {
      const mockAlchemyResponse = {
        result: {
          tokenBalances: [
            {
              contractAddress: "0xtoken1",
              tokenBalance: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
            }, // 1000000000000000000 (1e18)
            {
              contractAddress: "0xtoken2",
              balance: "0x00000000000000000000000000000000000000000000000000000000000000c8",
            }, // 200 (older API format)
            { contractAddress: "0xtoken3", tokenBalance: "0x64" }, // 100
          ],
        },
      };

      // First call fails (GoldRush), second call succeeds (Alchemy)
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error("GoldRush API error"))
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue(mockAlchemyResponse),
        });

      const result = await getWalletBalances(walletAddr, network, chain, {
        goldRush: { apiKey: "test-key", timeoutMs: 100 },
        alchemy: { apiKey: "test-key", timeoutMs: 100 },
      });

      expect(result).toEqual({
        "0xtoken1": 1000000000000000000n,
        "0xtoken2": 200n,
        "0xtoken3": 100n,
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        "https://eth-mainnet.g.alchemy.com/v2/test-key",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "alchemy_getTokenBalances",
            params: [walletAddr, "erc20"],
          }),
        }),
      );
    });

    it("should skip indexer when chain is not supported", async () => {
      const mockGoldRushResponse = {
        data: {
          items: [{ contract_address: "0xToken1", balance: "100" }],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(mockGoldRushResponse),
      });

      // Use a chain that only GoldRush supports (e.g., Solana for Mainnet)
      const result = await getWalletBalances(walletAddr, network, "Solana", {
        goldRush: { apiKey: "test-key", timeoutMs: 100 },
        alchemy: { apiKey: "test-key", timeoutMs: 100 },
      });

      expect(result).toEqual({
        "0xtoken1": 100n,
      });
      // Should only call GoldRush since Alchemy doesn't support Solana
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should throw error when all indexers fail", async () => {
      // Both fetch calls fail
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error("GoldRush API error"))
        .mockRejectedValueOnce(new Error("Alchemy API error"));

      await expect(
        getWalletBalances(walletAddr, network, chain, {
          goldRush: { apiKey: "test-key", timeoutMs: 100 },
          alchemy: { apiKey: "test-key", timeoutMs: 100 },
        }),
      ).rejects.toThrow(`Failed to get a successful response from indexers`);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should handle timeout and abort requests", async () => {
      jest.useFakeTimers();

      const mockAlchemyResponse = {
        result: {
          tokenBalances: [
            { contractAddress: "0xtoken1", balance: "0x64" }, // 100 in hex
          ],
        },
      };

      // First call (GoldRush) hangs and gets aborted, second call (Alchemy) succeeds
      (global.fetch as jest.Mock)
        .mockImplementationOnce((_url, options) => {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {}, 200); // Keep event loop alive
            options?.signal?.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(options.signal.reason);
            });
          });
        })
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue(mockAlchemyResponse),
        });

      const resultPromise = getWalletBalances(walletAddr, network, chain, {
        goldRush: { apiKey: "test-key", timeoutMs: 100 },
        alchemy: { apiKey: "test-key", timeoutMs: 100 },
      });

      // Fast-forward time to trigger timeout
      await jest.advanceTimersByTimeAsync(100);

      const result = await resultPromise;

      expect(result).toEqual({
        "0xtoken1": 100n,
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it("should return native balance if included in indexer response", async () => {
      const mockGoldRushResponse = {
        data: {
          items: [
            { contract_address: "0xToken1", balance: "100" },
            {
              contract_address: "0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
              balance: "500",
            },
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(mockGoldRushResponse),
      });

      const result = await getWalletBalances(walletAddr, network, chain, {
        goldRush: { apiKey: "test-key", timeoutMs: 100 },
      });

      expect(result).toEqual({
        "0xtoken1": 100n,
        native: 500n,
      });
      expect(result.native).toBe(500n);
    });

    it("should skip indexers with empty or missing API keys", async () => {
      const mockAlchemyResponse = {
        result: {
          tokenBalances: [
            { contractAddress: "0xtoken1", balance: "0x64" }, // 100 in hex
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(mockAlchemyResponse),
      });

      // GoldRush has empty API key, only Alchemy should be called
      const result = await getWalletBalances(walletAddr, network, chain, {
        goldRush: { apiKey: "", timeoutMs: 100 },
        alchemy: { apiKey: "test-key", timeoutMs: 100 },
      });

      expect(result).toEqual({
        "0xtoken1": 100n,
      });
      // Should only call Alchemy since GoldRush has empty API key
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://eth-mainnet.g.alchemy.com/v2/test-key",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("should skip tokens with invalid balance values from Alchemy", async () => {
      const mockAlchemyResponse = {
        result: {
          tokenBalances: [
            { contractAddress: "0xtoken1", tokenBalance: "0x64" }, // 100 - valid
            { contractAddress: "0xtoken2", tokenBalance: "invalid_hex" }, // invalid
            { contractAddress: "0xtoken3", balance: "not a number" }, // invalid
            { contractAddress: "0xtoken4", tokenBalance: "0xc8" }, // 200 - valid
            { contractAddress: "0xtoken5" }, // missing balance field
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(mockAlchemyResponse),
      });

      const result = await getWalletBalances(walletAddr, network, chain, {
        alchemy: { apiKey: "test-key", timeoutMs: 100 },
      });

      // Only valid tokens should be included
      expect(result).toEqual({
        "0xtoken1": 100n,
        "0xtoken4": 200n,
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
