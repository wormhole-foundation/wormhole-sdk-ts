import {
  Commitment,
  Connection,
  PublicKey,
  PublicKeyInitData,
} from '@solana/web3.js';
import { ChainId, toChainId } from '@wormhole-foundation/connect-sdk';
import { utils } from '@wormhole-foundation/connect-sdk-solana';

export function deriveWrappedMintKey(
  tokenBridgeProgramId: PublicKeyInitData,
  tokenChain: number | ChainId,
  tokenAddress: Buffer | Uint8Array,
): PublicKey {
  if (tokenChain == toChainId('Solana')) {
    throw new Error(
      'tokenChain == CHAIN_ID_SOLANA does not have wrapped mint key',
    );
  }

  return utils.deriveAddress(
    [
      Buffer.from('wrapped'),
      (() => {
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(tokenChain as number);
        return buf;
      })(),
      tokenAddress as Uint8Array,
    ],
    tokenBridgeProgramId,
  );
}

export function deriveWrappedMetaKey(
  tokenBridgeProgramId: PublicKeyInitData,
  mint: PublicKeyInitData,
): PublicKey {
  return utils.deriveAddress(
    [Buffer.from('meta'), new PublicKey(mint).toBuffer()],
    tokenBridgeProgramId,
  );
}

export async function getWrappedMeta(
  connection: Connection,
  tokenBridgeProgramId: PublicKeyInitData,
  mint: PublicKeyInitData,
  commitment?: Commitment,
): Promise<WrappedMeta> {
  return connection
    .getAccountInfo(
      deriveWrappedMetaKey(tokenBridgeProgramId, mint),
      commitment,
    )
    .then((info) => WrappedMeta.deserialize(utils.getAccountData(info)));
}

export class WrappedMeta {
  chain: number;
  tokenAddress: Buffer;
  originalDecimals: number;
  lastUpdatedSequence?: bigint;

  constructor(
    chain: number,
    tokenAddress: Buffer,
    originalDecimals: number,
    lastUpdatedSequence?: bigint,
  ) {
    this.chain = chain;
    this.tokenAddress = tokenAddress;
    this.originalDecimals = originalDecimals;
    this.lastUpdatedSequence = lastUpdatedSequence;
  }

  static deserialize(data: Buffer): WrappedMeta {
    if (data.length !== 35 && data.length !== 43) {
      throw new Error(`invalid wrapped meta length: ${data.length}`);
    }
    const chain = data.readUInt16LE(0);
    const tokenAddress = data.subarray(2, 34);
    const originalDecimals = data.readUInt8(34);
    const lastUpdatedSequence =
      data.length === 43 ? data.readBigUInt64LE(35) : undefined;
    return new WrappedMeta(
      chain,
      tokenAddress,
      originalDecimals,
      lastUpdatedSequence,
    );
  }
}
