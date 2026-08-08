import { encoding } from '@wormhole-foundation/sdk-connect';
import { SolanaAddress, SolanaZeroAddress } from './../../src/index.js';

describe('SolanaAddress tests', () => {
  test('parses the all-digits base58 zero address as base58, not hex', () => {
    const address = new SolanaAddress(SolanaZeroAddress);
    expect(address.toString()).toBe(SolanaZeroAddress);
    expect(address.toUint8Array()).toEqual(new Uint8Array(32));
  });

  test('round-trips a regular base58 address', () => {
    const wsolMint = 'So11111111111111111111111111111111111111112';
    expect(new SolanaAddress(wsolMint).toString()).toBe(wsolMint);
  });

  test('still parses 64-char hex strings as hex', () => {
    const bytes = new Uint8Array(32).fill(1);
    const hex = encoding.hex.encode(bytes);
    expect(new SolanaAddress(hex).toUint8Array()).toEqual(bytes);
  });

  test('still parses 0x-prefixed hex strings as hex', () => {
    const bytes = new Uint8Array(32).fill(2);
    const hex = `0x${encoding.hex.encode(bytes)}`;
    expect(new SolanaAddress(hex).toUint8Array()).toEqual(bytes);
  });
});
