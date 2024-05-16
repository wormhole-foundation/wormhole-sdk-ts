import type { Connection, PublicKeyInitData } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import type { Provider } from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { utils } from '@wormhole-foundation/sdk-solana';
import { TokenBridgeCoder } from './coder/index.js';
import {
  type TokenBridge,
  TOKEN_BRIDGE_IDL as IDL,
} from '../../tokenBridgeType.js';

export function createTokenBridgeProgramInterface(
  programId: PublicKeyInitData,
  provider?: Provider,
): Program<TokenBridge> {
  return new Program<TokenBridge>(
    IDL as TokenBridge,
    new PublicKey(programId),
    provider === undefined ? ({ connection: null } as any) : provider,
    coder(),
  );
}

export function createReadOnlyTokenBridgeProgramInterface(
  programId: PublicKeyInitData,
  connection?: Connection,
): Program<TokenBridge> {
  return createTokenBridgeProgramInterface(
    programId,
    utils.createReadOnlyProvider(connection),
  );
}

export function coder(): TokenBridgeCoder {
  return new TokenBridgeCoder(IDL as TokenBridge);
}
