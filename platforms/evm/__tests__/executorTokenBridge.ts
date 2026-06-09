import { jest } from "@jest/globals";
import { Interface, ZeroAddress } from 'ethers';
import { Wormhole } from '@wormhole-foundation/sdk-connect';
import { EvmAddress, EvmPlatform } from '@wormhole-foundation/sdk-evm';
import { EvmExecutorTokenBridge } from '@wormhole-foundation/sdk-evm-tokenbridge';
import type {
  ExecutorTokenBridge,
  SignedQuote,
} from '@wormhole-foundation/sdk-definitions';

// Subset of the V2 ABI that we exercise in this test — we decode only the
// transaction calldata produced by EvmExecutorTokenBridge.transfer(), so it's
// fine to redeclare it locally rather than re-export the ABI from the package.
const V2_ABI = [
  'function wrapAndTransferEthWithRelay(address tokenBridgeRelayer, uint256 amount, uint16 targetChain, bytes32 targetRecipient, uint32 nonce, bytes32 dstTransferRecipient, bytes32 dstExecutionAddress, uint256 executionAmount, address refundAddr, bytes calldata signedQuoteBytes, bytes calldata relayInstructions, tuple(uint256 transferTokenFee, uint256 nativeTokenFee, address payee) feeArgs) payable returns (uint64)',
  'function transferTokensWithRelay(address tokenBridgeRelayer, address token, uint256 amount, uint16 targetChain, bytes32 targetRecipient, uint32 nonce, bytes32 dstTransferRecipient, bytes32 dstExecutionAddress, uint256 executionAmount, address refundAddr, bytes calldata signedQuoteBytes, bytes calldata relayInstructions, tuple(uint256 transferTokenFee, uint256 nativeTokenFee, address payee) feeArgs) payable returns (uint64)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 value) returns (bool)',
];

const iface = new Interface(V2_ABI);
const erc20Iface = new Interface(ERC20_ABI);

describe('EvmExecutorTokenBridge', () => {
  const SENDER_ADDRESS = '0x49887A216375FDED17DC1aAAD4920c3777265614';
  const REFERRER_ADDRESS = '0x9b2A3B92b1D86938D3Ed37B0519952C227bA6D09';
  const TOKEN_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'; // arbitrary ERC20
  // Wormhole message fee on Sepolia. Stubbed below to avoid a live RPC call.
  const WORMHOLE_FEE = 0n;

  function makeExecutor() {
    // Sepolia testnet has both `relayer` and `relayerWithReferrer` configured
    // in core/base, so the EvmExecutorTokenBridge constructor will populate
    // both addresses. A minimal Provider stub is enough — the wrapNative path
    // doesn't read any chain state (no allowance check, no balanceOf).
    const provider = { _isProvider: true } as any;
    const executor = new EvmExecutorTokenBridge('Testnet', 'Sepolia', provider, {
      coreBridge: '0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78', // Sepolia
      executorTokenBridge: {
        relayer: '0xb0b2119067cF04fa959f654250BD49fE1BD6F53c',
        relayerWithReferrer: '0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0',
      },
    } as any);
    // Stub core.getMessageFee so we don't hit an RPC.
    (executor as any).core = {
      getMessageFee: jest.fn<() => Promise<any>>().mockResolvedValue(WORMHOLE_FEE),
    };
    return executor;
  }

  function makeExecutorQuote(): ExecutorTokenBridge.ExecutorQuote {
    const signedQuote: SignedQuote = {
      quote: {
        prefix: 'EQ01',
        quoterAddress: new Uint8Array(20),
        payeeAddress: new Uint8Array(32),
        srcChain: 10002, // Sepolia
        dstChain: 10003, // ArbitrumSepolia
        expiryTime: new Date(Date.now() + 60_000),
        baseFee: 0n,
        dstGasPrice: 0n,
        srcPrice: 0n,
        dstPrice: 0n,
      },
      signature: new Uint8Array(65),
    };
    return {
      signedQuote,
      estimatedCost: 50_000n,
      relayInstructions: { requests: [] },
    };
  }

  async function firstTx(gen: AsyncGenerator<any>) {
    for await (const tx of gen) {
      return tx;
    }
    throw new Error('generator produced no transactions');
  }

  async function collectTxs(gen: AsyncGenerator<any>) {
    const txs = [];
    for await (const tx of gen) {
      txs.push(tx);
    }
    return txs;
  }

  function stubTokenImplementation(allowance: bigint) {
    const fake = {
      allowance: jest.fn<() => Promise<any>>().mockResolvedValue(allowance),
      approve: {
        populateTransaction: jest.fn(
          async (spender: string, value: bigint) => ({
            to: TOKEN_ADDRESS,
            data: erc20Iface.encodeFunctionData('approve', [spender, value]),
          }),
        ),
      },
    };
    jest
      .spyOn(EvmPlatform, 'getTokenImplementation')
      .mockReturnValue(fake as any);
    return fake;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('folds transferTokenFee into nativeTokenFee on the wrapAndTransferEthWithRelay path', async () => {
    const executor = makeExecutor();
    // The EvmAddress imported from src vs dist of @wormhole-foundation/sdk-evm
    // have a structurally-equal but nominally-distinct private field that TS
    // refuses to unify; the runtime types are identical so a cast is safe.
    const sender = new EvmAddress(SENDER_ADDRESS) as any;
    const recipient = Wormhole.chainAddress('BaseSepolia', SENDER_ADDRESS);
    const executorQuote = makeExecutorQuote();

    const amount = 100_000_000n;
    const transferTokenFee = 1_000_000n;
    const nativeTokenFee = 500_000n;
    const remainingAmount = amount - transferTokenFee;
    const expectedCombined = transferTokenFee + nativeTokenFee;

    const referrerFee: ExecutorTokenBridge.ReferrerFee = {
      transferTokenFee,
      nativeTokenFee,
      remainingAmount,
      referrer: Wormhole.chainAddress('Sepolia', REFERRER_ADDRESS),
    };

    const tx = await firstTx(
      executor.transfer(
        sender,
        recipient,
        'native', // triggers the wrap path
        amount,
        executorQuote,
        referrerFee,
      ),
    );

    const decoded = iface.parseTransaction({ data: tx.transaction.data });
    expect(decoded?.name).toBe('wrapAndTransferEthWithRelay');

    // The contract bridges exactly what we pass as `amount` — pass the
    // post-fee remainder so the helper doesn't bridge the gross amount and
    // *also* pull transferTokenFee from msg.value (double charge).
    expect(decoded?.args.amount).toBe(remainingAmount);

    // The contract pulls nativeTokenFee out of msg.value but tries to pull
    // transferTokenFee via safeTransferFrom — which would revert for a user
    // who only sent native gas. The SDK folds transferTokenFee into
    // nativeTokenFee so the referrer gets paid out of msg.value in one shot.
    expect(decoded?.args.feeArgs.transferTokenFee).toBe(0n);
    expect(decoded?.args.feeArgs.nativeTokenFee).toBe(expectedCombined);
    expect((decoded?.args.feeArgs.payee as string).toLowerCase()).toBe(
      REFERRER_ADDRESS.toLowerCase(),
    );

    // msg.value = bridgedAmount + wormholeFee + executionAmount + combinedNativeFee.
    // Total user spend (in native gas): amount + wormholeFee + executionAmount + nativeTokenFee.
    expect(tx.transaction.value).toBe(
      remainingAmount +
        WORMHOLE_FEE +
        executorQuote.estimatedCost +
        expectedCombined,
    );
  });

  it('falls back to a zero-fee feeArgs when no referrerFee is provided', async () => {
    const executor = makeExecutor();
    // The EvmAddress imported from src vs dist of @wormhole-foundation/sdk-evm
    // have a structurally-equal but nominally-distinct private field that TS
    // refuses to unify; the runtime types are identical so a cast is safe.
    const sender = new EvmAddress(SENDER_ADDRESS) as any;
    const recipient = Wormhole.chainAddress('BaseSepolia', SENDER_ADDRESS);
    const executorQuote = makeExecutorQuote();
    const amount = 100_000_000n;

    const tx = await firstTx(
      executor.transfer(sender, recipient, 'native', amount, executorQuote),
    );

    const decoded = iface.parseTransaction({ data: tx.transaction.data });
    expect(decoded?.args.feeArgs.transferTokenFee).toBe(0n);
    expect(decoded?.args.feeArgs.nativeTokenFee).toBe(0n);
    expect((decoded?.args.feeArgs.payee as string).toLowerCase()).toBe(
      ZeroAddress.toLowerCase(),
    );
    expect(tx.transaction.value).toBe(
      amount + WORMHOLE_FEE + executorQuote.estimatedCost,
    );
  });

  it('folds nativeTokenFee-only into combinedNativeFee on the native path', async () => {
    const executor = makeExecutor();
    const sender = new EvmAddress(SENDER_ADDRESS) as any;
    const recipient = Wormhole.chainAddress('BaseSepolia', SENDER_ADDRESS);
    const executorQuote = makeExecutorQuote();

    const amount = 100_000_000n;
    const nativeTokenFee = 500_000n;
    const referrerFee: ExecutorTokenBridge.ReferrerFee = {
      transferTokenFee: 0n,
      nativeTokenFee,
      remainingAmount: amount,
      referrer: Wormhole.chainAddress('Sepolia', REFERRER_ADDRESS),
    };

    const tx = await firstTx(
      executor.transfer(sender, recipient, 'native', amount, executorQuote, referrerFee),
    );

    const decoded = iface.parseTransaction({ data: tx.transaction.data });
    expect(decoded?.args.amount).toBe(amount);
    expect(decoded?.args.feeArgs.transferTokenFee).toBe(0n);
    expect(decoded?.args.feeArgs.nativeTokenFee).toBe(nativeTokenFee);
    expect(tx.transaction.value).toBe(
      amount + WORMHOLE_FEE + executorQuote.estimatedCost + nativeTokenFee,
    );
  });

  it('folds transferTokenFee-only into combinedNativeFee on the native path', async () => {
    const executor = makeExecutor();
    const sender = new EvmAddress(SENDER_ADDRESS) as any;
    const recipient = Wormhole.chainAddress('BaseSepolia', SENDER_ADDRESS);
    const executorQuote = makeExecutorQuote();

    const amount = 100_000_000n;
    const transferTokenFee = 1_000_000n;
    const remainingAmount = amount - transferTokenFee;
    const referrerFee: ExecutorTokenBridge.ReferrerFee = {
      transferTokenFee,
      nativeTokenFee: 0n,
      remainingAmount,
      referrer: Wormhole.chainAddress('Sepolia', REFERRER_ADDRESS),
    };

    const tx = await firstTx(
      executor.transfer(sender, recipient, 'native', amount, executorQuote, referrerFee),
    );

    const decoded = iface.parseTransaction({ data: tx.transaction.data });
    expect(decoded?.args.amount).toBe(remainingAmount);
    expect(decoded?.args.feeArgs.transferTokenFee).toBe(0n);
    expect(decoded?.args.feeArgs.nativeTokenFee).toBe(transferTokenFee);
    expect(tx.transaction.value).toBe(
      remainingAmount +
        WORMHOLE_FEE +
        executorQuote.estimatedCost +
        transferTokenFee,
    );
  });

  it('emits approve + transferTokensWithRelay with two-tier feeArgs on the ERC20 path', async () => {
    const executor = makeExecutor();
    const sender = new EvmAddress(SENDER_ADDRESS) as any;
    const recipient = Wormhole.chainAddress('BaseSepolia', SENDER_ADDRESS);
    const executorQuote = makeExecutorQuote();

    const amount = 100_000_000n;
    const transferTokenFee = 1_000_000n;
    const nativeTokenFee = 500_000n;
    const remainingAmount = amount - transferTokenFee;
    const requiredAllowance = remainingAmount + transferTokenFee;

    const referrerFee: ExecutorTokenBridge.ReferrerFee = {
      transferTokenFee,
      nativeTokenFee,
      remainingAmount,
      referrer: Wormhole.chainAddress('Sepolia', REFERRER_ADDRESS),
    };

    const fakeToken = stubTokenImplementation(0n);

    const token = new EvmAddress(TOKEN_ADDRESS) as any;
    const txs = await collectTxs(
      executor.transfer(sender, recipient, token, amount, executorQuote, referrerFee),
    );

    expect(txs).toHaveLength(2);
    expect(txs[0].description).toBe('approve');
    expect(txs[1].description).toBe('transferTokensWithRelay');

    expect(fakeToken.allowance).toHaveBeenCalledWith(
      SENDER_ADDRESS,
      '0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0',
    );
    expect(fakeToken.approve.populateTransaction).toHaveBeenCalledWith(
      '0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0',
      requiredAllowance,
    );

    const decoded = iface.parseTransaction({ data: txs[1].transaction.data });
    expect(decoded?.name).toBe('transferTokensWithRelay');
    expect(decoded?.args.amount).toBe(remainingAmount);
    expect((decoded?.args.token as string).toLowerCase()).toBe(
      TOKEN_ADDRESS.toLowerCase(),
    );
    expect(decoded?.args.feeArgs.transferTokenFee).toBe(transferTokenFee);
    expect(decoded?.args.feeArgs.nativeTokenFee).toBe(nativeTokenFee);
    expect((decoded?.args.feeArgs.payee as string).toLowerCase()).toBe(
      REFERRER_ADDRESS.toLowerCase(),
    );

    // ERC20 path: msg.value excludes the bridged amount and the
    // ERC20-denominated transferTokenFee — only native-gas fees are passed.
    expect(txs[1].transaction.value).toBe(
      WORMHOLE_FEE + executorQuote.estimatedCost + nativeTokenFee,
    );
  });

  it('skips the approve tx on the ERC20 path when allowance is already sufficient', async () => {
    const executor = makeExecutor();
    const sender = new EvmAddress(SENDER_ADDRESS) as any;
    const recipient = Wormhole.chainAddress('BaseSepolia', SENDER_ADDRESS);
    const executorQuote = makeExecutorQuote();

    const amount = 100_000_000n;
    const transferTokenFee = 1_000_000n;
    const nativeTokenFee = 500_000n;
    const remainingAmount = amount - transferTokenFee;
    const requiredAllowance = remainingAmount + transferTokenFee;

    const referrerFee: ExecutorTokenBridge.ReferrerFee = {
      transferTokenFee,
      nativeTokenFee,
      remainingAmount,
      referrer: Wormhole.chainAddress('Sepolia', REFERRER_ADDRESS),
    };

    const fakeToken = stubTokenImplementation(requiredAllowance);

    const token = new EvmAddress(TOKEN_ADDRESS) as any;
    const txs = await collectTxs(
      executor.transfer(sender, recipient, token, amount, executorQuote, referrerFee),
    );

    expect(txs).toHaveLength(1);
    expect(txs[0].description).toBe('transferTokensWithRelay');
    expect(fakeToken.approve.populateTransaction).not.toHaveBeenCalled();
  });

  it('falls back to a zero-fee feeArgs and approves the full amount on the ERC20 path with no referrerFee', async () => {
    const executor = makeExecutor();
    const sender = new EvmAddress(SENDER_ADDRESS) as any;
    const recipient = Wormhole.chainAddress('BaseSepolia', SENDER_ADDRESS);
    const executorQuote = makeExecutorQuote();
    const amount = 100_000_000n;

    const fakeToken = stubTokenImplementation(0n);

    const token = new EvmAddress(TOKEN_ADDRESS) as any;
    const txs = await collectTxs(
      executor.transfer(sender, recipient, token, amount, executorQuote),
    );

    expect(txs).toHaveLength(2);
    expect(fakeToken.approve.populateTransaction).toHaveBeenCalledWith(
      '0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0',
      amount,
    );

    const decoded = iface.parseTransaction({ data: txs[1].transaction.data });
    expect(decoded?.args.amount).toBe(amount);
    expect(decoded?.args.feeArgs.transferTokenFee).toBe(0n);
    expect(decoded?.args.feeArgs.nativeTokenFee).toBe(0n);
    expect((decoded?.args.feeArgs.payee as string).toLowerCase()).toBe(
      ZeroAddress.toLowerCase(),
    );
    expect(txs[1].transaction.value).toBe(
      WORMHOLE_FEE + executorQuote.estimatedCost,
    );
  });
});
