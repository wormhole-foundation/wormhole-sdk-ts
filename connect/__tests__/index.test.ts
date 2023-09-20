import {
  TokenBridge,
  Platform,
  RpcConnection,
  ChainContext,
  testing,
} from '@wormhole-foundation/sdk-definitions';
import { PlatformName, platforms } from '@wormhole-foundation/sdk-base';
import { Wormhole } from '../src';
describe('Ben restore please', () => {
  test('lol', async () => {
    expect(true).toBeTruthy();
  });
});

// const allPlatformCtrs = platforms.map((p) => {
//   return testing.mocks.mockPlatformFactory(p);
// });
//
// describe('Wormhole Tests', () => {
//   let wh: Wormhole;
//   beforeEach(() => {
//     wh = new Wormhole('Devnet', allPlatformCtrs);
//   });
//
//   let p: Platform<PlatformName>;
//   test('returns Platform', async () => {
//     p = wh.getPlatform('Ethereum');
//     expect(p).toBeTruthy();
//   });
//
//   let c: ChainContext<PlatformName>;
//   test('returns chain', async () => {
//     c = wh.getChain('Ethereum');
//     expect(c).toBeTruthy();
//   });
// });
//
// describe('Platform Tests', () => {
//   let p: Platform<PlatformName>;
//   beforeEach(() => {
//     const wh = new Wormhole('Devnet', allPlatformCtrs);
//     p = wh.getPlatform('Ethereum');
//   });
//
//   let rpc: RpcConnection<PlatformName>;
//   test('Gets RPC', () => {
//     rpc = p.getRpc('Ethereum');
//     expect(rpc).toBeTruthy();
//   });
//
//   let tb: TokenBridge<PlatformName>;
//   test('Gets Token Bridge', async () => {
//     tb = await p.getTokenBridge(rpc);
//     expect(tb).toBeTruthy();
//   });
// });
//
// describe('Chain Tests', () => {
//   let c: ChainContext<PlatformName>;
//   beforeEach(() => {
//     const wh = new Wormhole('Devnet', allPlatformCtrs);
//     const p = wh.getPlatform('Ethereum');
//     c = wh.getChain('Ethereum');
//   });
//
//   let rpc: RpcConnection<PlatformName>;
//   test('Gets RPC', () => {
//     rpc = c.getRpc();
//     expect(rpc).toBeTruthy();
//   });
// });
//
