import {
  ChainContext,
  PlatformContext,
  RpcConnection,
  TokenBridge,
  testing,
  Network,
  Platform,
  Wormhole,
  Chain,
} from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

const allPlatformCtrs = [SolanaPlatform, EvmPlatform];

describe("Wormhole Tests", () => {
  let wh: Wormhole<Network>;
  beforeEach(() => {
    wh = new Wormhole("Devnet", allPlatformCtrs);
  });

  let p: PlatformContext<Network, Platform>;
  test("returns Platform", async () => {
    p = wh.getPlatform("Evm");
    expect(p).toBeTruthy();
  });

  let c: ChainContext<Network, Platform, Chain>;
  test("returns chain", async () => {
    c = wh.getChain("Ethereum");
    expect(c).toBeTruthy();
  });

  test("should parse address", () => {
    const chain = "Ethereum";
    const address = testing.utils.makeNativeAddress(chain);

    const result = Wormhole.parseAddress(chain, address.toString());
    expect(result).toBeTruthy();
  });

  test("should handle parseMessageFromTx", async () => {
    // Setup, Test, and Assertions as above
  });

  // ...
});

describe("Platform Tests", () => {
  let p: PlatformContext<Network, "Evm">;
  beforeEach(() => {
    const wh = new Wormhole("Devnet", allPlatformCtrs);
    p = wh.getPlatform("Evm");
  });

  let rpc: RpcConnection<Platform>;
  test("Gets RPC", () => {
    rpc = p.getRpc("Ethereum");
    expect(rpc).toBeTruthy();
  });

  let tb: TokenBridge<"Devnet", "Evm", "Ethereum">;
  test("Gets Token Bridge", async () => {
    tb = await p.getProtocol("TokenBridge", rpc);
    expect(tb).toBeTruthy();
  });
});

describe("Chain Tests", () => {
  let c: ChainContext<"Devnet", "Evm", "Ethereum">;
  beforeEach(() => {
    const wh = new Wormhole<"Devnet">("Devnet", allPlatformCtrs);
    c = wh.getChain("Ethereum");
  });

  let rpc: RpcConnection<Platform>;
  test("Gets RPC", () => {
    rpc = c.getRpc();
    expect(rpc).toBeTruthy();
  });
});

// describe("Attestation Tests", () => {
//   const wh = new Wormhole("Testnet", []);
//   describe("VAA Tests", () => {
//     test("GetVAA", async () => {
//       const parsedVaa = await wh.getVaa(
//         "Celo",
//         new UniversalAddress(
//           "0x00000000000000000000000005ca6037eC51F8b712eD2E6Fa72219FEaE74E153",
//         ),
//         469n,
//         "AttestMeta"
//       );
//       expect(parsedVaa).toBeTruthy();
//     });
//   });
// });

// test("Recover Transfer Message ID", async () => {
//   const solEmitter = new SolanaAddress(SOL_TB_EMITTER).toUniversalAddress();
//   const msgIds = await solCtx.parseTransaction(
//     "4PE9CWyUj5SZH2XcyV7HZjYtNHyPRb4qi1zRtPptw1yewst5A4H1zKfbGsFFhCTELga3HJmhGtK6gEmEiGeKopSH"
//   );
//   expect(msgIds.length).toBe(1);
//   expect(msgIds[0].chain).toEqual("Solana");
//   expect(msgIds[0].sequence).toBeGreaterThan(0);
//   expect(msgIds[0].emitter.toUniversalAddress().equals(solEmitter)).toEqual(
//     true
//   );
// });

// describe('Circle Transfer', () => {
//   it('should create a cctpTransfer', async () => {
//     // Setup
//     // your mock setup here

//     // Test
//     await wormhole.cctpTransfer(100n, {}, {}, true);

//     test('cctpTransfer Error for Unsupported Chain', async () => {
//       const from: ChainAddress = {
//         chain: 'unsupported',
//         address: 'some_address',
//       };
//       const to: ChainAddress = { chain: 'Ethereum', address: 'some_address' };

//       await expect(
//         wormhole.cctpTransfer(BigInt(1), from, to, false),
//       ).rejects.toThrow(/Network and chain not supported/);
//     });

//     test('tokenTransfer Error for Payload with Automatic', async () => {
//       const from: ChainAddress = {
//         chain: 'Ethereum',
//         address: 'some_address',
//       };
//       const to: ChainAddress = { chain: 'Ethereum', address: 'some_address' };

//       await expect(
//         wormhole.tokenTransfer(
//           'native',
//           BigInt(1),
//           from,
//           to,
//           true,
//           new Uint8Array(),
//         ),
//       ).rejects.toThrow(/Payload with automatic delivery is not supported/);
//     });

//     // Assertions
//     // your assertions here
//   });
// });

// describe('Token Transfer', () => {
//   it('should handle tokenTransfer', async () => {
//     // Setup, Test, and Assertions as above
//   });
// });

// describe('Contract Accessors', () => {
//   it('should get contracts', () => {
//     const result = wormhole.getContracts(`Ethereum`);
//     expect(result).toBeTruthy();
//   });

//   it('should throw error if mustGetContracts fails', () => {
//     // @ts-ignore
//     expect(() => wormhole.mustGetContracts('InvalidChain')).toThrow();
//   });
// });

// it('should get platform', () => {
//   const result = wormhole.getPlatform('Ethereum');
//   expect(result).toBeTruthy();
// });

// it('should get chain', () => {
//   const result = wormhole.getChain('Ethereum');
//   expect(result).toBeTruthy();
// });

// it('should handle getWrappedAsset', async () => {
//   // Setup, Test, and Assertions as above
// });

// it('should handle mustGetWrappedAsset', async () => {
//   // Setup, Test, and Assertions as above
// });

// it('should handle getTokenDecimals', async () => {
//   // Setup, Test, and Assertions as above
// });

// it('should handle getNativeBalance', async () => {
//   // Setup, Test, and Assertions as above
// });

// it('should handle getTokenBalance', async () => {
//   // Setup, Test, and Assertions as above
// });

// it('should check if supportsSendWithRelay', () => {
//   const result = wormhole.supportsSendWithRelay('Ethereum');
//   expect(typeof result).toBe('boolean');
// });

// it('should handle getVaaBytes', async () => {
//   // Setup, Test, and Assertions as above
// });

// it('should handle getVaa', async () => {
//   // Setup, Test, and Assertions as above
// });

// it('should handle getTransactionStatus', async () => {
//   // Setup, Test, and Assertions as above
// });

// it('should handle getCircleAttestation', async () => {
//   // Setup, Test, and Assertions as above
// });

// });

//  let wormhole: Wormhole;
//  beforeEach(async () => {
//    const contextConfig = {
//      ['Evm']: MockContext1,
//      ['Solana']: MockContext2,
//    };
//    wormhole = new Wormhole(network, [MockContext1, MockContext2]);
//  });
//  it('initializes and registers context classes correctly', async () => {
//    const evmContext = wormhole.getContext('Ethereum');
//    const solanaContext = wormhole.getContext('Solana');
//    const evmAnswer = await evmContext.startTransfer(
//      'native',
//      BigInt(0),
//      1,
//      '',
//      2,
//      '',
//      undefined,
//    );
//    expect(evmAnswer).toEqual(1);
//    const solanaAnswer = await solanaContext.startTransfer(
//      'native',
//      BigInt(0),
//      1,
//      '',
//      2,
//      '',
//      undefined,
//    );
//    expect(solanaAnswer).toEqual(2);
//  });
//  it('contexts can access other contexts', async () => {
//    const evmContext = wormhole.getContext('Ethereum');
//    const solanaContext = wormhole.getContext('Solana');
//    const getSolanaFromEvm = evmContext.wormhole.getContext('Solana');
//    expect(getSolanaFromEvm).toBeTruthy();
//    const getEvmFromSolana = solanaContext.wormhole.getContext('Ethereum');
//    expect(getEvmFromSolana).toBeTruthy();
//  });

// describe('Initialize Objects', () => {
//   const wh = new Wormhole('Testnet', [EvmPlatform]);
//
//   let ethCtx: EvmChain;
//   test('Get Ethereum Context', () => {
//     ethCtx = wh.getChain('Celo') as EvmChain;
//     expect(ethCtx).toBeTruthy();
//   });
//
//   let tokenBridge: TokenBridge<'Evm'>;
//   test('Get Ethereum Token Bridge', async () => {
//     tokenBridge = await ethCtx.getTokenBridge();
//     expect(tokenBridge).toBeTruthy();
//   });
//
//   test('Recover Transfer Details', async () => {
//     const txs = await ethCtx.parseTransaction(
//       '0xb7677fabbe96e2caf10fdc14a3c971e60ff49458e83528c2594d87a7238af838',
//     );
//     expect(txs.length).toBe(1);
//
//     //const tx: WormholeMessageId = txs[0];
//     //expect(tx.details.amount).toBe(0n);
//     //expect(tx.details.from.chain).toBe('Celo');
//   });
//
//   test('Recover Wormhole Transfer', async () => {
//     const txident: TransactionId = {
//       chain: 'Celo',
//       txid: '0xb7677fabbe96e2caf10fdc14a3c971e60ff49458e83528c2594d87a7238af838',
//     };
//     const tx = await TokenTransfer.from(wh, txident);
//     expect(tx).toBeTruthy();
//   });
//
//   // test('Create Transfer Transaction', async () => {
//   //   const ethAddy = new UniversalAddress(new Uint8Array(20));
//   //   const solAddy = new UniversalAddress(new Uint8Array(32));
//
//   //   const txgen = tokenBridge.transfer(
//   //     ethAddy,
//   //     ['Solana', solAddy],
//   //     'native',
//   //     1000n,
//   //   );
//
//   //   for await (const tx of txgen) {
//   //     expect(tx).toBeTruthy();
//   //   }
//   // });
// });
//
