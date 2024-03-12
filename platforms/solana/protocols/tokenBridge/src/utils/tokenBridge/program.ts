import type { Connection, PublicKeyInitData } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import type { Provider } from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { utils } from '@wormhole-foundation/sdk-solana';
import { TokenBridgeCoder } from './coder';
import type { TokenBridge } from '../../tokenBridgeType';

import IDL from '../../anchor-idl/token_bridge.json';

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
