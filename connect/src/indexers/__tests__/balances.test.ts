import fetchMock from "@fetch-mock/jest";
import { getWalletBalances } from "../balances.js";

describe("balances", () => {
  beforeEach(() => {
    fetchMock.mockGlobal();
  });

  afterEach(() => {
    fetchMock.clearHistory();
    fetchMock.removeRoutes();
    fetchMock.unmockGlobal();
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

      fetchMock.getOnce(
        `https://api.covalenthq.com/v1/eth-mainnet/address/${walletAddr}/balances_v2/?key=test-key`,
        { status: 200, body: mockGoldRushResponse },
      );

      const result = await getWalletBalances(walletAddr, network, chain, {
        goldRush: { apiKey: "test-key", timeoutMs: 100 },
      });

      expect(result).toEqual({
        "0xtoken1": 100n,
        "0xtoken2": 200n,
        native: 1000n,
      });
      expect(fetchMock).toHaveFetchedTimes(1);
    });

    it("should fallback to Alchemy when GoldRush fails", async () => {
      const mockAlchemyBatchResponse = [
        {
          id: 1,
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
        },
        {
          id: 2,
          result: "0x2386f26fc10000", // 10000000000000000
        },
      ];

      // First call fails (GoldRush), second call succeeds (Alchemy batch request)
      fetchMock
        .getOnce(
          `https://api.covalenthq.com/v1/eth-mainnet/address/${walletAddr}/balances_v2/?key=test-key`,
          {
            throws: new Error("GoldRush API error"),
          },
        )
        .postOnce("https://eth-mainnet.g.alchemy.com/v2/test-key", {
          status: 200,
          body: mockAlchemyBatchResponse,
        });

      const result = await getWalletBalances(walletAddr, network, chain, {
        goldRush: { apiKey: "test-key", timeoutMs: 100 },
        alchemy: { apiKey: "test-key", timeoutMs: 100 },
      });

      expect(result).toEqual({
        "0xtoken1": 1000000000000000000n,
        "0xtoken2": 200n,
        "0xtoken3": 100n,
        native: 10000000000000000n,
      });
      expect(fetchMock).toHaveFetchedTimes(2);
      expect(fetchMock).toHaveLastFetched("https://eth-mainnet.g.alchemy.com/v2/test-key");
    });

    it("should skip indexer when chain is not supported", async () => {
      const mockGoldRushResponse = {
        data: {
          items: [{ contract_address: "0xToken1", balance: "100" }],
        },
      };

      fetchMock.getOnce(
        `https://api.covalenthq.com/v1/solana-mainnet/address/${walletAddr}/balances_v2/?key=test-key`,
        { status: 200, body: mockGoldRushResponse },
      );

      // Use a chain that only GoldRush supports (e.g., Solana for Mainnet)
      const result = await getWalletBalances(walletAddr, network, "Solana", {
        goldRush: { apiKey: "test-key", timeoutMs: 100 },
        alchemy: { apiKey: "test-key", timeoutMs: 100 },
      });

      expect(result).toEqual({
        "0xtoken1": 100n,
      });
      // Should only call GoldRush since Alchemy doesn't support Solana
      expect(fetchMock).toHaveFetchedTimes(1);
    });

    it("should throw error when all indexers fail", async () => {
      // All fetch calls fail
      fetchMock
        .getOnce(
          `https://api.covalenthq.com/v1/eth-mainnet/address/${walletAddr}/balances_v2/?key=test-key`,
          {
            throws: new Error("GoldRush API error"),
          },
        )
        .postOnce("https://eth-mainnet.g.alchemy.com/v2/test-key", {
          throws: new Error("Alchemy batch API error"),
        });

      await expect(
        getWalletBalances(walletAddr, network, chain, {
          goldRush: { apiKey: "test-key", timeoutMs: 100 },
          alchemy: { apiKey: "test-key", timeoutMs: 100 },
        }),
      ).rejects.toThrow(`Failed to get a successful response from indexers`);

      expect(fetchMock).toHaveFetchedTimes(2);
    });

    it("should handle timeout and abort requests", async () => {
      jest.useFakeTimers();

      const mockAlchemyBatchResponse = [
        {
          id: 1,
          result: {
            tokenBalances: [
              { contractAddress: "0xtoken1", balance: "0x64" }, // 100 in hex
            ],
          },
        },
        {
          id: 2,
          result: "0x64", // 100
        },
      ];

      // First call (GoldRush) hangs and gets aborted, second call (Alchemy batch) succeeds
      fetchMock
        .getOnce(
          `https://api.covalenthq.com/v1/eth-mainnet/address/${walletAddr}/balances_v2/?key=test-key`,
          (_url: string, options: RequestInit) => {
            return new Promise((resolve, reject) => {
              const timer = setTimeout(() => {}, 200); // Keep event loop alive
              const signal = options?.signal;
              if (signal) {
                signal.addEventListener("abort", () => {
                  clearTimeout(timer);
                  reject(signal.reason);
                });
              }
            });
          },
        )
        .postOnce("https://eth-mainnet.g.alchemy.com/v2/test-key", {
          status: 200,
          body: mockAlchemyBatchResponse,
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
        native: 100n,
      });
      expect(fetchMock).toHaveFetchedTimes(2);

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

      fetchMock.getOnce(
        `https://api.covalenthq.com/v1/eth-mainnet/address/${walletAddr}/balances_v2/?key=test-key`,
        { status: 200, body: mockGoldRushResponse },
      );

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
      const mockAlchemyBatchResponse = [
        {
          id: 1,
          result: {
            tokenBalances: [
              { contractAddress: "0xtoken1", balance: "0x64" }, // 100 in hex
            ],
          },
        },
        {
          id: 2,
          result: "0xc8", // 200
        },
      ];

      fetchMock.postOnce("https://eth-mainnet.g.alchemy.com/v2/test-key", {
        status: 200,
        body: mockAlchemyBatchResponse,
      });

      // GoldRush has empty API key, only Alchemy should be called
      const result = await getWalletBalances(walletAddr, network, chain, {
        goldRush: { apiKey: "", timeoutMs: 100 },
        alchemy: { apiKey: "test-key", timeoutMs: 100 },
      });

      expect(result).toEqual({
        "0xtoken1": 100n,
        native: 200n,
      });
      // Should only call Alchemy since GoldRush has empty API key
      expect(fetchMock).toHaveFetchedTimes(1);
      expect(fetchMock).toHaveLastFetched("https://eth-mainnet.g.alchemy.com/v2/test-key");
    });

    it("should skip tokens with invalid balance values from Alchemy", async () => {
      const mockAlchemyBatchResponse = [
        {
          id: 1,
          result: {
            tokenBalances: [
              { contractAddress: "0xtoken1", tokenBalance: "0x64" }, // 100 - valid
              { contractAddress: "0xtoken2", tokenBalance: "invalid_hex" }, // invalid
              { contractAddress: "0xtoken3", balance: "not a number" }, // invalid
              { contractAddress: "0xtoken4", tokenBalance: "0xc8" }, // 200 - valid
              { contractAddress: "0xtoken5" }, // missing balance field
            ],
          },
        },
        {
          id: 2,
          result: "0x12c", // 300 - valid
        },
      ];

      fetchMock.postOnce("https://eth-mainnet.g.alchemy.com/v2/test-key", {
        status: 200,
        body: mockAlchemyBatchResponse,
      });

      const result = await getWalletBalances(walletAddr, network, chain, {
        alchemy: { apiKey: "test-key", timeoutMs: 100 },
      });

      // Only valid tokens should be included
      expect(result).toEqual({
        "0xtoken1": 100n,
        "0xtoken4": 200n,
        native: 300n,
      });
      expect(fetchMock).toHaveFetchedTimes(1);
    });

    it("should return Solana balances from GoldRush indexer", async () => {
      const solanaWalletAddr = "7yLKkp1HS2v9eJtPqT3crvhv7usuNWmQ87GLx48Ck8jJ";
      const solanaNetwork = "Mainnet";
      const solanaChain = "Solana";

      const mockGoldRushSolanaResponse = {
        data: {
          address: "7yLKkp1HS2v9eJtPqT3crvhv7usuNWmQ87GLx48Ck8jJ",
          updated_at: "2025-11-13T16:43:58.954959826Z",
          chain_name: "solana-mainnet",
          items: [
            {
              contract_address: "11111111111111111111111111111111",
              contract_name: "Solana",
              contract_ticker_symbol: "SOL",
              native_token: true,
              balance: "1835627474",
            },
            {
              contract_address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
              contract_name: "USD Coin",
              contract_ticker_symbol: "USDC",
              native_token: false,
              balance: "123874778",
            },
            {
              contract_address: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
              contract_name: "Ether (Portal)",
              contract_ticker_symbol: "ETH",
              native_token: false,
              balance: "2455863",
            },
            {
              contract_address: "So11111111111111111111111111111111111111112",
              contract_name: "Wrapped SOL",
              contract_ticker_symbol: "SOL",
              native_token: false,
              balance: "199700",
            },
          ],
        },
      };

      fetchMock.getOnce(
        `https://api.covalenthq.com/v1/solana-mainnet/address/${solanaWalletAddr}/balances_v2/?key=test-key`,
        { status: 200, body: mockGoldRushSolanaResponse },
      );

      const result = await getWalletBalances(solanaWalletAddr, solanaNetwork, solanaChain, {
        goldRush: { apiKey: "test-key", timeoutMs: 100 },
      });

      expect(result).toEqual({
        // Native SOL (contract_address: 11111111111111111111111111111111)
        native: 1835627474n,
        // USDC
        epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v: 123874778n,
        // ETH (Portal)
        "7vfcxtuxx5wjv5jadk17duj4ksgau7utnkj4b963voxs": 2455863n,
        // Wrapped SOL
        so11111111111111111111111111111111111111112: 199700n,
      });

      expect(fetchMock).toHaveFetchedTimes(1);
    });
  });
});
