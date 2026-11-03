import { describe, expect, test } from '@jest/globals';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Connection } from '@solana/web3.js';
import { SolanaPlatform } from '../../src/platform.js';

describe('Solana finalized block queries', () => {
  test.each([
    { slot: 1_000, height: 1_000, lastValidBlockHeight: 1_150 },
    {
      slot: 400_000_000,
      height: 380_000_000,
      lastValidBlockHeight: 380_000_150,
    },
    { slot: 0, height: 0, lastValidBlockHeight: 150 },
  ])(
    'returns the finalized slot $slot rather than an expiry height',
    async (fixture) => {
      const calls: { method: string; params: unknown[] }[] = [];
      const server = createServer(async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const { id, method, params } = JSON.parse(
          Buffer.concat(chunks).toString(),
        );
        calls.push({ method, params });
        const result =
          method === 'getSlot'
            ? params[0].commitment === 'finalized'
              ? fixture.slot
              : fixture.slot + 32
            : method === 'getBlockHeight'
              ? fixture.height
              : {
                  context: { slot: fixture.slot },
                  value: {
                    blockhash: '11111111111111111111111111111111',
                    lastValidBlockHeight: fixture.lastValidBlockHeight,
                  },
                };
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id, result }));
      });
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );
      try {
        const rpc = new Connection(
          `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
          'confirmed',
        );
        expect(await SolanaPlatform.getLatestFinalizedBlock(rpc)).toBe(
          fixture.slot,
        );
        const chain = new SolanaPlatform('Mainnet').getChain('Solana', rpc);
        expect(await chain.getLatestFinalizedBlock()).toBe(fixture.slot);
        expect(await chain.getLatestBlock()).toBe(fixture.slot + 32);
        expect(calls).toEqual([
          { method: 'getSlot', params: [{ commitment: 'finalized' }] },
          { method: 'getSlot', params: [{ commitment: 'finalized' }] },
          { method: 'getSlot', params: [{ commitment: 'confirmed' }] },
        ]);
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    },
  );
});
