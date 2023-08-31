import { Wormhole } from '@wormhole-foundation/connect-sdk';
import {
  TokenBridge,
  ChainAddress,
  UniversalAddress,
  TokenId,
  NativeAddress,
} from '@wormhole-foundation/sdk-definitions';

import { SolanaPlatform } from '../../src/platform';
import { SolanaAddress, SolanaChain } from '../../src';
import { MockSolanaSigner } from '../mocks/MockSigner';

describe('Solana Unit Tests', () => {
  const wh = new Wormhole('Testnet', [SolanaPlatform]);

  let solCtx: SolanaChain;
  test('Get Solana Context', () => {
    solCtx = wh.getChain('Solana') as SolanaChain;
    expect(solCtx).toBeTruthy();
  });
});
