import { describe, expect, test } from '@jest/globals';
import { PublicKey } from '@solana/web3.js';
import {
  UniversalAddress,
  nativeTokenId,
} from '@wormhole-foundation/sdk-connect';
import { SolanaAddress, SolanaZeroAddress } from '../../src/address.js';
import { SolanaPlatform } from '../../src/platform.js';

describe('Solana native token identification', () => {
  test.each(['Mainnet', 'Testnet', 'Devnet'] as const)(
    'matches native token values on %s',
    (network) => {
      const token = SolanaPlatform.nativeTokenId(network, 'Solana');
      expect(token.address.toString()).toBe(SolanaZeroAddress);
      expect(SolanaPlatform.isNativeTokenId(network, 'Solana', token)).toBe(
        true,
      );
      expect(
        SolanaPlatform.isNativeTokenId(
          network,
          'Solana',
          Object.freeze({
            chain: 'Solana',
            address: new SolanaAddress(new PublicKey(SolanaZeroAddress)),
          }),
        ),
      ).toBe(true);
      expect(
        SolanaPlatform.isNativeTokenId(network, 'Solana', {
          chain: 'Solana',
          address: new UniversalAddress(new Uint8Array(32)),
        }),
      ).toBe(true);
      expect(
        SolanaPlatform.isNativeTokenId(
          network,
          'Solana',
          nativeTokenId('Solana'),
        ),
      ).toBe(true);
    },
  );

  test('rejects wrapped SOL and the unrelated address produced by the old string parser', () => {
    for (const address of [
      'So11111111111111111111111111111111111111112',
      '111111111111111137EWfWxhwVEGTT5BcjfE2L',
    ]) {
      expect(
        SolanaPlatform.isNativeTokenId('Mainnet', 'Solana', {
          chain: 'Solana',
          address: new SolanaAddress(new PublicKey(address)),
        }),
      ).toBe(false);
    }
    const nonzero = new Uint8Array(32);
    nonzero[31] = 1;
    expect(
      SolanaPlatform.isNativeTokenId('Mainnet', 'Solana', {
        chain: 'Solana',
        address: new UniversalAddress(nonzero),
      }),
    ).toBe(false);
  });

  test('rejects a native token on another chain or an unsupported platform', () => {
    expect(
      SolanaPlatform.isNativeTokenId(
        'Mainnet',
        'Solana',
        nativeTokenId('Ethereum'),
      ),
    ).toBe(false);
    expect(
      SolanaPlatform.isNativeTokenId(
        'Mainnet',
        'Ethereum',
        nativeTokenId('Ethereum'),
      ),
    ).toBe(false);
    expect(() =>
      SolanaPlatform.nativeTokenId('Mainnet', 'Ethereum' as never),
    ).toThrow('invalid chain');
  });

  test('preserves the chain for the other supported Solana platform chain', () => {
    const token = SolanaPlatform.nativeTokenId('Mainnet', 'Pythnet');
    expect(token.chain).toBe('Pythnet');
    expect(token.address.toString()).toBe(SolanaZeroAddress);
    expect(SolanaPlatform.isNativeTokenId('Mainnet', 'Pythnet', token)).toBe(
      true,
    );
    expect(SolanaPlatform.isNativeTokenId('Mainnet', 'Solana', token)).toBe(
      false,
    );
  });
});
