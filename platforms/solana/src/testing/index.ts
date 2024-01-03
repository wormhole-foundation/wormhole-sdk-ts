import { Connection, Keypair } from '@solana/web3.js';
import { SolanaPlatform } from '../platform';
import { SolanaSigner } from './signer';
import { Signer, encoding } from '@wormhole-foundation/connect-sdk';
import { SolanaSendSigner } from './sendSigner';

// returns a SignOnlySigner for the Solana platform
export async function getSolanaSigner(
  rpc: Connection,
  privateKey: string,
): Promise<Signer> {
  const [_, chain] = await SolanaPlatform.chainFromRpc(rpc);
  return new SolanaSigner(
    chain,
    Keypair.fromSecretKey(encoding.b58.decode(privateKey)),
    rpc,
  );
}

// returns a SignAndSendSigner for the Solana platform
export async function getSolanaSignAndSendSigner(
  rpc: Connection,
  privateKey: string,
): Promise<Signer> {
  const [_, chain] = await SolanaPlatform.chainFromRpc(rpc);
  return new SolanaSendSigner(
    rpc,
    chain,
    Keypair.fromSecretKey(encoding.b58.decode(privateKey)),
  );
}

export * from './signer';
export * from './sendSigner';
