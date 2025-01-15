import { SolanaTokenBridge } from '@wormhole-foundation/sdk-solana-tokenbridge';
import {
  Connection,
  Keypair,
  PublicKey,
  Signer,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { Chain, Network, serializeLayout } from '@wormhole-foundation/sdk-base';
import {
  Contracts,
  UniversalAddress,
  createVAA,
  VAA,
} from '@wormhole-foundation/sdk-definitions';
import { utils as coreUtils } from '@wormhole-foundation/sdk-solana-core';

import { getBlockTime, sendAndConfirm } from './../helper.js';
import { SolanaSendSigner } from '@wormhole-foundation/sdk-solana';
import { signAndSendWait } from '@wormhole-foundation/sdk-connect';
import { layoutItems } from '@wormhole-foundation/sdk-definitions';
import { TestingWormholeCore } from './wormhole-core.js';

/** A Token Bridge wrapper allowing to write tests using this program in a local environment. */
export class TestingTokenBridge<N extends Network> {
  static sequence = 100n;
  public readonly client: SolanaTokenBridge<N, 'Solana'>;

  public signer: Signer;
  public solanaProgram: PublicKey;
  public testingCoreClient: TestingWormholeCore<N>;

  /**
   *
   * @param solanaProgram The Solana Program used as a destination for the VAAs, _i.e._ the program being tested.
   * @param contracts At least the addresses `coreBridge` and `tokenBridge` must be provided.
   */
  constructor(
    connection: Connection,
    signer: Signer,
    network: N,
    contracts: Contracts,
    coreClient: TestingWormholeCore<N>,
    solanaProgram: PublicKey,
  ) {
    this.signer = signer;
    this.testingCoreClient = coreClient;
    this.solanaProgram = solanaProgram;
    this.client = new SolanaTokenBridge(
      network,
      'Solana',
      connection,
      contracts,
    );
  }

  get coreBridgeId() {
    return this.client.coreBridge.coreBridge.programId;
  }

  get keypair() {
    return Keypair.fromSecretKey(this.signer.secretKey);
  }

  get pda() {
    return {
      config: () => this.findPda(Buffer.from('config')),

      endpoint: (chain: Chain, address: UniversalAddress) => {
        return this.findPda(
          serializeLayout(
            { ...layoutItems.chainItem(), endianness: 'big' },
            chain,
          ),
          address.toUint8Array(),
        );
      },

      claim: (emitterAddress: UniversalAddress, sequence: bigint) => {
        const sequenceBytes = Buffer.alloc(8);
        sequenceBytes.writeBigUInt64BE(sequence);

        return this.findPda(
          emitterAddress.toUint8Array(),
          Buffer.from([0, 1]),
          sequenceBytes,
        );
      },
    };
  }

  async initialize() {
    const ix = await this.client.tokenBridge.methods
      .initialize(this.coreBridgeId)
      .accounts({
        payer: this.signer.publicKey,
        config: this.pda.config(),
      })
      .instruction();

    return await sendAndConfirm(this.client.connection, ix, this.signer);
  }

  async registerPeer(chain: Chain, address: UniversalAddress) {
    const sequence = TestingTokenBridge.sequence++;
    const timestamp = await getBlockTime(this.client.connection);
    const emitterAddress = new UniversalAddress('00'.repeat(31) + '04');
    const rawVaa = createVAA('TokenBridge:RegisterChain', {
      guardianSet: 0,
      timestamp,
      nonce: 0,
      emitterChain: 'Solana',
      emitterAddress,
      sequence,
      consistencyLevel: 1,
      signatures: [],
      payload: {
        chain: 'Solana',
        actionArgs: { foreignChain: chain, foreignAddress: address },
      },
    });
    const vaa = this.testingCoreClient.guardians.addSignatures(rawVaa, [0]);
    const txs = this.client.coreBridge.postVaa(this.signer.publicKey, vaa);
    const signer = new SolanaSendSigner(
      this.client.connection,
      'Solana',
      this.keypair,
      false,
      {},
    );
    await signAndSendWait(txs, signer);

    const vaaAddress = coreUtils.derivePostedVaaKey(
      this.coreBridgeId,
      Buffer.from(vaa.hash),
    );

    const ix = await this.client.tokenBridge.methods
      .registerChain()
      .accounts({
        payer: this.signer.publicKey,
        vaa: vaaAddress,
        endpoint: this.pda.endpoint(chain, address),
        config: this.pda.config(),
        claim: this.pda.claim(emitterAddress, sequence),
        wormholeProgram: this.coreBridgeId,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    await sendAndConfirm(this.client.connection, ix, this.signer);
  }

  async attestToken(
    emitter: UniversalAddress,
    chain: Chain,
    mint: UniversalAddress,
    info: { decimals: number },
  ) {
    const signer = new SolanaSendSigner(
      this.client.connection,
      'Solana',
      this.keypair,
      false,
      {},
    );

    const sequence = TestingTokenBridge.sequence++;
    const timestamp = await getBlockTime(this.client.connection);
    const rawVaa = createVAA('TokenBridge:AttestMeta', {
      guardianSet: 0,
      timestamp,
      nonce: 0,
      emitterChain: chain,
      emitterAddress: emitter,
      sequence,
      consistencyLevel: 1,
      signatures: [],
      payload: {
        decimals: info.decimals,
        symbol: '12345678901234567890123456789012',
        name: '12345678901234567890123456789012',
        token: { chain, address: mint },
      },
    });
    const vaa = this.testingCoreClient.guardians.addSignatures(rawVaa, [0]);
    const txsPostVaa = this.client.coreBridge.postVaa(
      this.signer.publicKey,
      vaa,
    );
    await signAndSendWait(txsPostVaa, signer);

    const txsAttest = this.client.submitAttestation(
      rawVaa,
      this.signer.publicKey,
    );
    await signAndSendWait(txsAttest, signer);
  }

  /**
   * Parse a VAA generated from the postVaa method, or from the Token Bridge during
   * and outbound transfer
   */
  async parseVaaTransferWithPayload(
    account: PublicKey,
  ): Promise<VAA<'TokenBridge:TransferWithPayload'>> {
    return this.testingCoreClient.parseVaa(
      'TokenBridge:TransferWithPayload',
      account,
    );
  }

  /**
   * @param token Where the token comes from: chain, and mint/address.
   * @param source Who emits the transfer:
   *   @param `source.tokenBridge` The foreign Token Bridge emitting the transfer;
   *   @param `source.relayer` The foreign smart contract having initiated the transfer (for example, and EVM relayer contract).
   * @param innerPayload The payload associated with the transfer.
   * @returns The address of the stored vaa/message.
   */
  async postTransferWithPayload(
    token: {
      amount: bigint;
      chain: Chain;
      address: UniversalAddress;
    },
    source: {
      chain: Chain;
      tokenBridge: UniversalAddress;
      relayer: UniversalAddress;
    },
    innerPayload: Uint8Array,
  ): Promise<PublicKey> {
    const payload = {
      token,
      to: {
        address: new UniversalAddress(this.solanaProgram.toBytes()),
        chain: 'Solana' as const,
      },
      from: source.relayer,
      payload: innerPayload,
    };

    return this.testingCoreClient.postVaa(
      this.signer,
      source,
      'TokenBridge:TransferWithPayload',
      payload,
    );
  }

  /**
   * Parse a VAA generated from the postVaa method, or from the Token Bridge during
   * and outbound transfer
   */
  async parseVaaTransfer(
    account: PublicKey,
  ): Promise<VAA<'TokenBridge:Transfer'>> {
    return this.testingCoreClient.parseVaa('TokenBridge:Transfer', account);
  }

  /**
   * @param token Where the token comes from: chain, and mint/address.
   * @param source The foreign Token Bridge emitting the transfer.
   * @param fee The fee to pay to get the tokens.
   * @returns The address of the stored vaa/message.
   */
  async postTransfer(
    payer: Keypair,
    token: {
      amount: bigint;
      chain: Chain;
      address: UniversalAddress;
    },
    source: {
      chain: Chain;
      tokenBridge: UniversalAddress;
    },
    fee: bigint,
  ): Promise<PublicKey> {
    const payload = {
      token,
      to: {
        address: new UniversalAddress(this.solanaProgram.toBytes()),
        chain: 'Solana' as const,
      },
      fee,
    };

    return this.testingCoreClient.postVaa(
      payer,
      source,
      'TokenBridge:Transfer',
      payload,
    );
  }

  private findPda(...seeds: Array<Buffer | Uint8Array>) {
    return PublicKey.findProgramAddressSync(
      seeds,
      this.client.tokenBridge.programId,
    )[0];
  }
}
