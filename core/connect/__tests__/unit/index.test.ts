import {
  TokenBridge,
  UniversalAddress,
  Platform,
  RpcConnection,
  VAA,
  ChainContext,
} from '@wormhole-foundation/sdk-definitions';
import { PlatformName } from '@wormhole-foundation/sdk-base';
import { Wormhole } from '../../src';
import { MockPlatform } from '../mocks/mockPlatform';

describe('Wormhole Tests', () => {
  let wh: Wormhole;
  test('Initializes Wormhole', async () => {
    wh = new Wormhole('Devnet', [MockPlatform]);
  });

  let p: Platform<PlatformName>;
  test('Returns Platform', async () => {
    p = wh.getPlatform('Ethereum');
    expect(p).toBeTruthy();
  });

  let c: ChainContext<PlatformName>;
  test('Returns chain', async () => {
    c = wh.getChain('Ethereum');
    expect(c).toBeTruthy();
  });
});

describe('Platform Tests', () => {
  const wh: Wormhole = new Wormhole('Devnet', [MockPlatform]);
  const p: Platform<PlatformName> = wh.getPlatform('Ethereum');
  let rpc: RpcConnection;
  test('Gets RPC', () => {
    rpc = p.getRpc('Ethereum');
    expect(rpc).toBeTruthy();
  });

  let tb: TokenBridge<PlatformName>;
  test('Gets Token Bridge', async () => {
    tb = await p.getTokenBridge(rpc);
    expect(tb).toBeTruthy();
  });
});

describe('Chain Tests', () => {});

describe('VAA Tests', () => {
  const wh = new Wormhole('Testnet', []);

  test('GetVAA', async () => {
    const parsedVaa = await wh.getVAA(
      'Celo',
      new UniversalAddress(
        '0x00000000000000000000000005ca6037eC51F8b712eD2E6Fa72219FEaE74E153',
      ),
      469n,
    );
    expect(parsedVaa).toBeTruthy();
  });
});
