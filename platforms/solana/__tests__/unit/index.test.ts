import { Wormhole } from '@wormhole-foundation/connect-sdk';
import {
  ChainAddress,
  TokenBridge,
  TokenId,
  UniversalAddress,
} from '@wormhole-foundation/sdk-definitions';
import {
  SolanaChain,
  SolanaPlatform,
  SolanaUnsignedTransaction,
} from '../../src/';

// make sure to register the native address...
import '../../src/address';
import { SolanaTokenBridge } from '../../dist/esm';
import { chainToChainId } from '@wormhole-foundation/sdk-base';
import { PublicKey } from '@solana/web3.js';

const CHAIN = 'Solana';
const PLATFORM = CHAIN;

type P = typeof PLATFORM;

const address = [
  '4n4kd8bWSJvSzKfcyuQ8x3wKSx1QpyHhWv6J5sw3k4jY',
  '381e7091ac594a3bd7abb17669998b1db134111b4dab9d2d5cc8e5ef5d279127',
];

describe('Solana Chain Unit Tests', () => {
  const wh = new Wormhole('Testnet', [SolanaPlatform]);

  let solCtx: SolanaChain;
  test('Get Solana Context', () => {
    solCtx = wh.getChain(CHAIN) as SolanaChain;
    expect(solCtx).toBeTruthy();
    expect(solCtx.chain).toEqual(CHAIN);
  });

  test('Parses Address Correctly', () => {
    const expected = new UniversalAddress(
      new Uint8Array(Buffer.from(address[1], 'hex')),
    );
    const actual = solCtx.parseAddress(address[0]);
    expect(actual.equals(expected)).toBe(true);
  });

  test('Gets RPC Connection', () => {
    const rpc = solCtx.getRpc();
    //
    expect(rpc).toBeTruthy();
  });
});

describe('Solana TokenBridge Unit Tests', () => {
  const wh = new Wormhole('Testnet', [SolanaPlatform]);
  const solCtx: SolanaChain = wh.getChain(CHAIN) as SolanaChain;

  const sender = solCtx.parseAddress(address[0]);
  const receiver: ChainAddress = {
    chain: 'Avalanche',
    address: sender,
  };
  const amount = 10000000000n;
  const payload = new Uint8Array(Buffer.from('deadbeef'));

  let tokenBridge: SolanaTokenBridge;
  test('Gets token bridge', async () => {
    tokenBridge = (await solCtx.getTokenBridge()) as SolanaTokenBridge;
    expect(tokenBridge).toBeTruthy();
    expect(tokenBridge.chain).toEqual(CHAIN);
    expect(tokenBridge.chainId).toEqual(chainToChainId(CHAIN));
  });

  describe('Produces correct Transfer Transactions', () => {
    describe('Native Transfer', () => {
      test('Payload 1', async () => {
        const xferIter = tokenBridge.transfer(
          sender,
          receiver,
          'native',
          amount,
        );
        const txns = await collectTxns(xferIter);
        expect(txns.length).toEqual(1);

        const [{ transaction, description }] = txns;
        expect(description).toEqual('Solana.TransferNative');
        expect(transaction.feePayer!.toBase58()).toEqual(address[0]);

        const { instructions } = transaction;
        expect(instructions).toHaveLength(6);
      });

      test('Payload 3', async () => {
        const xferIter = tokenBridge.transfer(
          sender,
          receiver,
          'native',
          amount,
          payload,
        );
        const txns = await collectTxns(xferIter);
        expect(txns.length).toBeGreaterThan(0);
        console.log(txns);
      });
    });

    describe('Token Transfer', () => {
      test('Payload 1', async () => {
        const xferIter = tokenBridge.transfer(sender, receiver, sender, amount);
        const txns = await collectTxns(xferIter);
        expect(txns.length).toBeGreaterThan(0);
        console.log(txns);
      });
      test('Payload 3', async () => {
        const xferIter = tokenBridge.transfer(
          sender,
          receiver,
          sender,
          amount,
          payload,
        );
        const txns = await collectTxns(xferIter);
        expect(txns.length).toBeGreaterThan(0);
        console.log(txns);
      });
    });

    // test('Token Attest', async () => {
    //   const xfer = tokenBridge.createAttestation(sender);
    //   expect(collectTxns(xfer)).toThrow();
    // });
  });
});

async function collectTxns(
  i: AsyncGenerator<SolanaUnsignedTransaction>,
): Promise<SolanaUnsignedTransaction[]> {
  const txns = [];
  for await (const txn of i) {
    txns.push(txn);
  }
  return txns;
}
