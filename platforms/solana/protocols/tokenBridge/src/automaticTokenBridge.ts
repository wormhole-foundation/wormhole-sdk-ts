import {
  AccountAddress,
  AutomaticTokenBridge,
  Chain,
  ChainAddress,
  ChainId,
  ChainsConfig,
  Contracts,
  Network,
  TokenAddress,
  toChainId,
  toNative,
} from '@wormhole-foundation/connect-sdk';
import {
  SolanaAddress,
  SolanaChains,
  SolanaPlatform,
  SolanaPlatformType,
  SolanaTransaction,
  SolanaUnsignedTransaction,
} from '@wormhole-foundation/connect-sdk-solana';

import { BN, Program } from '@project-serum/anchor';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';

import { Platform } from '@wormhole-foundation/sdk-base/src';
import { TokenBridgeRelayer as TokenBridgeRelayerContract } from './automaticTokenBridgeType';
import {
  ForeignContract,
  RedeemerConfig,
  RegisteredToken,
  createTokenBridgeRelayerProgramInterface,
  createTransferNativeTokensWithRelayInstruction,
  createTransferWrappedTokensWithRelayInstruction,
  deriveForeignContractAddress,
  deriveRedeemerConfigAddress,
  deriveRegisteredTokenAddress,
} from './utils/automaticTokenBridge';

import {
  NATIVE_MINT,
  TokenAccountNotFoundError,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import '@wormhole-foundation/connect-sdk-solana-core';
import { registeredTokens } from './consts';

const SOL_DECIMALS = 9;
const TEN = new BN(10);
const SWAP_RATE_PRECISION = new BN(100_000_000);

export class SolanaAutomaticTokenBridge<
  N extends Network,
  C extends SolanaChains,
> implements AutomaticTokenBridge<N, SolanaPlatformType, C>
{
  readonly chainId: ChainId;

  readonly coreBridgeProgramId: PublicKey;
  readonly tokenBridgeProgramId: PublicKey;
  readonly tokenBridgeRelayer: Program<TokenBridgeRelayerContract>;

  private constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: Connection,
    readonly contracts: Contracts,
  ) {
    this.chainId = toChainId(chain);

    const tokenBridgeRelayerAddress = contracts.tokenBridgeRelayer;
    if (!tokenBridgeRelayerAddress)
      throw new Error(
        `TokenBridge contract Address for chain ${chain} not found`,
      );

    this.tokenBridgeRelayer = createTokenBridgeRelayerProgramInterface(
      tokenBridgeRelayerAddress,
      connection,
    );

    this.tokenBridgeProgramId = new PublicKey(contracts.tokenBridge!);
    this.coreBridgeProgramId = new PublicKey(contracts.coreBridge!);
  }
  static async fromRpc<N extends Network>(
    connection: Connection,
    config: ChainsConfig<N, Platform>,
  ): Promise<SolanaAutomaticTokenBridge<N, SolanaChains>> {
    const [network, chain] = await SolanaPlatform.chainFromRpc(connection);
    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(
        `Network mismatch for chain ${chain}: ${conf.network} != ${network}`,
      );

    return new SolanaAutomaticTokenBridge(
      network as N,
      chain,
      connection,
      conf.contracts,
    );
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    nativeGas?: bigint | undefined,
  ) {
    const nonce = 0;
    const senderAddress = new SolanaAddress(sender).unwrap();
    const recipientAddress = recipient.address
      .toUniversalAddress()
      .toUint8Array();

    const tokenMint =
      token === 'native'
        ? new PublicKey(NATIVE_MINT)
        : new SolanaAddress(token).unwrap();

    const transaction = new Transaction();
    if (token === 'native') {
      const ata = getAssociatedTokenAddressSync(tokenMint, senderAddress);
      try {
        await getAccount(this.connection, ata);
      } catch (e: any) {
        if (e instanceof TokenAccountNotFoundError) {
          // the relayer expects the wSOL associated token account to exist
          const createAccountInst = createAssociatedTokenAccountInstruction(
            senderAddress,
            ata,
            senderAddress,
            tokenMint,
          );
          transaction.add(createAccountInst);
        } else {
          throw e;
        }
      }
    }

    const nativeGasAmount = nativeGas ? nativeGas : 0n;

    const transferIx =
      token === 'native'
        ? await createTransferNativeTokensWithRelayInstruction(
            this.connection,
            this.tokenBridgeRelayer.programId,
            senderAddress,
            this.tokenBridgeProgramId,
            this.coreBridgeProgramId,
            tokenMint,
            amount,
            nativeGasAmount,
            recipientAddress,
            recipient.chain,
            nonce,
            token === 'native',
          )
        : await createTransferWrappedTokensWithRelayInstruction(
            this.connection,
            this.tokenBridgeRelayer.programId,
            senderAddress,
            this.tokenBridgeProgramId,
            this.coreBridgeProgramId,
            tokenMint,
            amount,
            nativeGasAmount,
            recipientAddress,
            recipient.chain,
            nonce,
          );

    transaction.add(transferIx);
    transaction.feePayer = senderAddress;

    yield this.createUnsignedTx(
      { transaction },
      'AutomaticTokenBridge.Transfer',
    );
  }

  async *redeem(sender: AccountAddress<C>, vaa: AutomaticTokenBridge.VAA) {
    const transaction = new Transaction();
    yield this.createUnsignedTx({ transaction }, 'AutomaticTokenBridge.Redeem');
    throw new Error('Method not implemented.');
  }

  async getRelayerFee(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
  ): Promise<bigint> {
    const tokenAddress =
      token === 'native'
        ? new PublicKey(NATIVE_MINT)
        : new SolanaAddress(token).unwrap();

    const [{ fee }, { swapRate }, { relayerFeePrecision }] = await Promise.all([
      this.getForeignContract(recipient.chain),
      this.getRegisteredToken(tokenAddress),
      this.getRedeemerConfig(),
    ]);

    const decimals = Number(
      await SolanaPlatform.getDecimals(this.chain, this.connection, token),
    );

    const relayerFee = TEN.pow(new BN(decimals))
      .mul(fee)
      .mul(SWAP_RATE_PRECISION)
      .div(new BN(relayerFeePrecision).mul(swapRate));

    return BigInt(relayerFee.toString());
  }

  async maxSwapAmount(token: TokenAddress<C>): Promise<bigint> {
    const mint =
      token === 'native'
        ? new PublicKey(NATIVE_MINT)
        : new SolanaAddress(token).unwrap();

    const [{ swapRate, maxNativeSwapAmount }, { swapRate: solSwapRate }] =
      await Promise.all([
        this.getRegisteredToken(mint),
        this.getRegisteredToken(NATIVE_MINT),
      ]);

    const decimals = Number(
      await SolanaPlatform.getDecimals(this.chain, this.connection, token),
    );

    const nativeSwapRate = this.calculateNativeSwapRate(solSwapRate, swapRate);
    const maxSwapAmountIn =
      decimals > SOL_DECIMALS
        ? maxNativeSwapAmount
            .mul(nativeSwapRate)
            .mul(TEN.pow(new BN(decimals - SOL_DECIMALS)))
            .div(SWAP_RATE_PRECISION)
        : maxNativeSwapAmount
            .mul(nativeSwapRate)
            .div(
              TEN.pow(new BN(SOL_DECIMALS - decimals)).mul(SWAP_RATE_PRECISION),
            );

    return BigInt(maxSwapAmountIn.toString());
  }

  async nativeTokenAmount(
    token: TokenAddress<C>,
    amount: bigint,
  ): Promise<bigint> {
    if (amount === 0n) return 0n;

    const mint =
      token === 'native'
        ? new PublicKey(NATIVE_MINT)
        : new SolanaAddress(token).unwrap();

    const decimals = Number(
      await SolanaPlatform.getDecimals(this.chain, this.connection, token),
    );

    const [{ swapRate }, { swapRate: solSwapRate }] = await Promise.all([
      this.getRegisteredToken(mint),
      this.getRegisteredToken(NATIVE_MINT),
    ]);
    const nativeSwapRate = this.calculateNativeSwapRate(solSwapRate, swapRate);
    const swapAmountOut =
      decimals > SOL_DECIMALS
        ? SWAP_RATE_PRECISION.mul(new BN(amount.toString())).div(
            nativeSwapRate.mul(TEN.pow(new BN(decimals - SOL_DECIMALS))),
          )
        : SWAP_RATE_PRECISION.mul(new BN(amount.toString()))
            .mul(TEN.pow(new BN(SOL_DECIMALS - decimals)))
            .div(nativeSwapRate);

    return BigInt(swapAmountOut.toString());
  }

  async isRegisteredToken(token: TokenAddress<C>): Promise<boolean> {
    const mint =
      token === 'native'
        ? new PublicKey(NATIVE_MINT)
        : new SolanaAddress(token).unwrap();

    try {
      await this.getRegisteredToken(mint);
      return true;
    } catch (e: any) {
      if (e.message?.includes('Account does not exist')) {
        // the token is not registered
        return false;
      }
      throw e;
    }
  }

  async getRegisteredTokens() {
    return registeredTokens[this.network].map((addr) =>
      toNative(this.chain, addr),
    );
  }

  private calculateNativeSwapRate(solSwapRate: BN, swapRate: BN): BN {
    return SWAP_RATE_PRECISION.mul(solSwapRate).div(swapRate);
  }

  private async getForeignContract(chain: Chain): Promise<ForeignContract> {
    return await this.tokenBridgeRelayer.account.foreignContract.fetch(
      deriveForeignContractAddress(this.tokenBridgeRelayer.programId, chain),
    );
  }

  private async getRegisteredToken(mint: PublicKey): Promise<RegisteredToken> {
    return await this.tokenBridgeRelayer.account.registeredToken.fetch(
      deriveRegisteredTokenAddress(this.tokenBridgeRelayer.programId, mint),
    );
  }

  private async getRedeemerConfig(): Promise<RedeemerConfig> {
    return await this.tokenBridgeRelayer.account.redeemerConfig.fetch(
      deriveRedeemerConfigAddress(this.tokenBridgeRelayer.programId),
    );
  }

  private createUnsignedTx(
    txReq: SolanaTransaction,
    description: string,
    parallelizable: boolean = false,
  ): SolanaUnsignedTransaction<N, C> {
    return new SolanaUnsignedTransaction(
      txReq,
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
