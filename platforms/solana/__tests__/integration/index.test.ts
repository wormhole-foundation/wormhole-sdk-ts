import {
  TokenBridge,
  Platform,
  testing,
  toNative,
} from '@wormhole-foundation/sdk-definitions';
import { chainConfigs } from '@wormhole-foundation/connect-sdk';

import {
  SolanaUnsignedTransaction,
  SolanaPlatform,
  SolanaContracts,
  SolanaTokenBridge,
} from '../../src/';

import { MockSolanaSigner } from '../mocks/MockSigner';

const NETWORK = 'Mainnet';
const configs = chainConfigs(NETWORK);

const TOKEN_ADDRESSES = {
  Mainnet: {
    Solana: {
      wsol: 'So11111111111111111111111111111111111111112',
      wavax: 'KgV1GvrHQmRBY8sHQQeUKwTm2r2h8t4C8qt12Cw1HVE',
    },
  },
};

const bogusAddress = testing.utils.makeNativeAddress('Solana');
const realNativeAddress = toNative(
  'Solana',
  TOKEN_ADDRESSES['Mainnet']['Solana']['wsol'],
);
const realWrappedAddress = toNative(
  'Solana',
  TOKEN_ADDRESSES['Mainnet']['Solana']['wavax'],
);

describe('TokenBridge Tests', () => {
  const p: Platform<'Solana'> = new SolanaPlatform(configs);
  let tb: TokenBridge<'Solana'>;

  test('Create TokenBridge', async () => {
    const rpc = p.getRpc('Solana');
    const contracts = new SolanaContracts(configs);
    // @ts-ignore
    tb = await SolanaTokenBridge.fromProvider(rpc, contracts);
    expect(tb).toBeTruthy();
  });

  describe('Get Wrapped Asset Details', () => {
    describe('isWrappedAsset', () => {
      test('Bogus', async () => {
        const isWrapped = await tb.isWrappedAsset(bogusAddress);
        expect(isWrapped).toBe(false);
      });

      test('Real Not Wrapped', async () => {
        const isWrapped = await tb.isWrappedAsset(realNativeAddress);
        expect(isWrapped).toBe(false);
      });

      test('Real Wrapped', async () => {
        const isWrapped = await tb.isWrappedAsset(realWrappedAddress);
        expect(isWrapped).toBe(true);
      });
    });

    describe('getOriginalAsset', () => {
      test('Bogus', async () => {
        expect(() => tb.getOriginalAsset(bogusAddress)).rejects.toThrow();
      });

      test('Real Not Wrapped', async () => {
        expect(() => tb.getOriginalAsset(realNativeAddress)).rejects.toThrow();
      });

      test('Real Wrapped', async () => {
        const orig = await tb.getOriginalAsset(realWrappedAddress);
        expect(orig.chain).toEqual('Avalanche');
        expect(orig).toBeTruthy();
      });
    });

    describe('hasWrappedAsset', () => {
      test('Bogus', async () => {
        const hasWrapped = await tb.hasWrappedAsset({
          chain: 'Avalanche',
          address: bogusAddress,
        });
        expect(hasWrapped).toBe(false);
      });

      test('Real Not Wrapped', async () => {
        const hasWrapped = await tb.hasWrappedAsset({
          chain: 'Avalanche',
          address: realNativeAddress,
        });
        expect(hasWrapped).toBe(false);
      });

      test('Real Wrapped', async () => {
        const orig = await tb.getOriginalAsset(realWrappedAddress);
        const hasWrapped = await tb.hasWrappedAsset(orig);
        expect(hasWrapped).toBe(true);
      });
    });

    describe('getWrappedAsset', () => {
      test('Bogus', async () => {
        const hasWrapped = tb.getWrappedAsset({
          chain: 'Avalanche',
          address: bogusAddress,
        });
        expect(hasWrapped).rejects.toThrow();
      });

      test('Real Not Wrapped', async () => {
        const hasWrapped = tb.getWrappedAsset({
          chain: 'Avalanche',
          address: realNativeAddress,
        });
        expect(hasWrapped).rejects.toThrow();
      });

      test('Real Wrapped', async () => {
        const orig = await tb.getOriginalAsset(realWrappedAddress);
        const wrappedAsset = await tb.getWrappedAsset(orig);
        expect(wrappedAsset.toString()).toBe(realWrappedAddress.toString());
      });
    });
  });

  // describe('Create Token Attestation Transactions', () => {
  //   const chain = 'Solana';
  //   const nativeAddress = testing.utils.makeNativeAddress(chain);

  //   const tbAddress = p.conf[chain]!.contracts.tokenBridge!;

  //   test('Create Attestation', async () => {
  //     const attestation = tb.createAttestation(nativeAddress);
  //     const allTxns: SolanaUnsignedTransaction[] = [];
  //     for await (const atx of attestation) {
  //       allTxns.push(atx);
  //     }
  //     expect(allTxns).toHaveLength(1);
  //     const [attestTx] = allTxns;
  //     expect(attestTx).toBeTruthy();
  //     expect(attestTx.chain).toEqual(chain);

  //     const { transaction } = attestTx;
  //     console.log(transaction);
  //     // expect(transaction.chainId).toEqual(
  //     //   evmNetworkChainToSolanaChainId(NETWORK, chain),
  //     // );
  //   });

  //   test('Submit Attestation', async () => {
  //     // TODO: generator for this
  //     const vaa: VAA<'AttestMeta'> = {
  //       payloadLiteral: 'AttestMeta',
  //       payload: {
  //         token: { address: nativeAddress.toUniversalAddress(), chain: chain },
  //         decimals: 8,
  //         symbol: Buffer.from(new Uint8Array(16)).toString('hex'),
  //         name: Buffer.from(new Uint8Array(16)).toString('hex'),
  //       },
  //       hash: new Uint8Array(32),
  //       guardianSet: 0,
  //       signatures: [{ guardianIndex: 0, signature: new Signature(1n, 2n, 1) }],
  //       emitterChain: chain,
  //       emitterAddress: toNative(chain, tbAddress).toUniversalAddress(),
  //       sequence: 0n,
  //       consistencyLevel: 0,
  //       timestamp: 0,
  //       nonce: 0,
  //     };
  //     const submitAttestation = tb.submitAttestation(vaa);

  //     const allTxns: SolanaUnsignedTransaction[] = [];
  //     for await (const atx of submitAttestation) {
  //       allTxns.push(atx);
  //     }
  //     expect(allTxns).toHaveLength(1);
  //     const [attestTx] = allTxns;
  //     expect(attestTx).toBeTruthy();
  //     expect(attestTx.chain).toEqual(chain);

  //     const { transaction } = attestTx;
  //     console.log(transaction);
  //     // expect(transaction.chainId).toEqual(
  //     //   evmNetworkChainToSolanaChainId(NETWORK, chain),
  //     // );
  //   });
  // });

  describe('Create TokenBridge Transactions', () => {
    const chain = 'Solana';
    const destChain = 'Ethereum';

    const sendSigner = new MockSolanaSigner();

    const sender = toNative(chain, sendSigner.address());
    const recipient = testing.utils.makeChainAddress(destChain);

    const tbAddress = p.conf[chain]!.contracts.tokenBridge!;

    const amount = 1000n;
    const payload = undefined;

    describe('Token Transfer Transactions', () => {
      describe('Transfer', () => {
        test('Native', async () => {
          const token = 'native';
          const xfer = tb.transfer(sender, recipient, token, amount, payload);
          expect(xfer).toBeTruthy();

          const allTxns: SolanaUnsignedTransaction[] = [];
          for await (const tx of xfer) {
            allTxns.push(tx);
          }
          expect(allTxns).toHaveLength(1);

          const [xferTx] = allTxns;
          expect(xferTx).toBeTruthy();
          expect(xferTx.chain).toEqual(chain);

          const { transaction } = xferTx;
          expect(transaction.instructions).toHaveLength(6);
          // ...
        });

        test('Token', async () => {
          const xfer = tb.transfer(
            sender,
            recipient,
            realWrappedAddress,
            amount,
            payload,
          );
          expect(xfer).toBeTruthy();

          const allTxns: SolanaUnsignedTransaction[] = [];
          for await (const tx of xfer) {
            allTxns.push(tx);
          }
          expect(allTxns).toHaveLength(1);

          const [xferTx] = allTxns;
          expect(xferTx).toBeTruthy();
          expect(xferTx.chain).toEqual(chain);

          const { transaction } = xferTx;
          expect(transaction.instructions).toHaveLength(2);
        });
      });
    });
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
