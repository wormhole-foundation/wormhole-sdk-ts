import { PublicKey } from '@solana/web3.js';
import { Chain, toChainId } from '@wormhole-foundation/sdk-connect';

export function getCustodianPda(gatewayProgramId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('redeemer')],
    new PublicKey(gatewayProgramId),
  )[0];
}

export function getCoreMessagePda(
  gatewayProgramId: PublicKey,
  sequence: bigint,
): PublicKey {
  const encodedSequence = Buffer.alloc(8);
  encodedSequence.writeBigUInt64LE(sequence);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('msg'), encodedSequence],
    new PublicKey(gatewayProgramId),
  )[0];
}

export function getGatewayInfoPda(
  gatewayProgramId: PublicKey,
  targetChain: Chain,
): PublicKey {
  const encodedChain = Buffer.alloc(2);
  encodedChain.writeUInt16LE(toChainId(targetChain));
  return PublicKey.findProgramAddressSync(
    [Buffer.from('gateway-info'), encodedChain],
    new PublicKey(gatewayProgramId),
  )[0];
}

// same address in mainnet and testnet
export const TBTC_PROGRAM_ID = new PublicKey(
  'Gj93RRt6QB7FjmyokAD5rcMAku7pq3Fk2Aa8y6nNbwsV',
);

export function getConfigPda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    TBTC_PROGRAM_ID,
  )[0];
}

export function getMinterInfoPda(minter: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('minter-info'), minter.toBuffer()],
    TBTC_PROGRAM_ID,
  )[0];
}
