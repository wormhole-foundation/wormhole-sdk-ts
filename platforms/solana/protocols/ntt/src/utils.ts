import { PublicKey, PublicKeyInitData } from '@solana/web3.js';
import {
  keccak256,
  Chain,
  encoding,
  toChainId,
  serializeLayout,
  NttManagerMessage,
  nttManagerMessageLayout,
  ChainId,
} from '@wormhole-foundation/sdk-connect';
import BN from 'bn.js';

type Seed = Uint8Array | string;

export function derivePda(
  seeds: Seed | readonly Seed[],
  programId: PublicKeyInitData,
) {
  const toBytes = (s: string | Uint8Array) =>
    typeof s === 'string' ? encoding.bytes.encode(s) : s;
  return PublicKey.findProgramAddressSync(
    Array.isArray(seeds) ? seeds.map(toBytes) : [toBytes(seeds as Seed)],
    new PublicKey(programId),
  )[0];
}

export interface TransferArgs {
  amount: BN;
  recipientChain: { id: ChainId };
  recipientAddress: number[];
  shouldQueue: boolean;
}

const chainToBytes = (chain: Chain) =>
  encoding.bignum.toBytes(toChainId(chain), 2);

export const nttAddresses = (programId: PublicKeyInitData) => {
  const configAccount = (): PublicKey => derivePda('config', programId);

  const outboxRateLimitAccount = (): PublicKey =>
    derivePda('outbox_rate_limit', programId);

  const inboxRateLimitAccount = (chain: Chain): PublicKey =>
    derivePda(['inbox_rate_limit', chainToBytes(chain)], programId);

  const inboxItemAccount = (
    chain: Chain,
    nttMessage: NttManagerMessage,
  ): PublicKey => {
    const digest = keccak256(
      encoding.bytes.concat(
        chainToBytes(chain),
        serializeLayout(nttManagerMessageLayout(), nttMessage),
      ),
    );
    return derivePda(['inbox_item', digest], programId);
  };

  const sessionAuthority = (
    sender: PublicKey,
    args: TransferArgs,
  ): PublicKey => {
    const { amount, recipientChain, recipientAddress, shouldQueue } = args;

    // TODO: ...
    const digest = keccak256(
      encoding.bytes.concat(
        amount.toArrayLike(Buffer, 'be', 8),
        Buffer.from(new BN(recipientChain.id).toArrayLike(Buffer, 'be', 2)),
        Buffer.from(new Uint8Array(recipientAddress)),
        Buffer.from([shouldQueue ? 1 : 0]),
      ),
    );
    return derivePda(
      ['session_authority', sender.toBytes(), digest],
      programId,
    );
  };

  const tokenAuthority = (): PublicKey =>
    derivePda('token_authority', programId);

  const emitterAccount = (): PublicKey => derivePda('emitter', programId);

  const wormholeMessageAccount = (outboxItem: PublicKey): PublicKey =>
    derivePda(['message', outboxItem.toBytes()], programId);

  const peerAccount = (chain: Chain): PublicKey =>
    derivePda(['peer', chainToBytes(chain)], programId);

  const transceiverPeerAccount = (chain: Chain): PublicKey =>
    derivePda(['transceiver_peer', chainToBytes(chain)], programId);

  const transceiverMessageAccount = (
    chain: Chain,
    id: Uint8Array,
  ): PublicKey => {
    if (id.length != 32) throw new Error('id must be 32 bytes');
    return derivePda(
      ['transceiver_message', chainToBytes(chain), id],
      programId,
    );
  };

  const registeredTransceiver = (transceiver: PublicKey): PublicKey =>
    derivePda(['registered_transceiver', transceiver.toBytes()], programId);

  return {
    configAccount,
    outboxRateLimitAccount,
    inboxRateLimitAccount,
    inboxItemAccount,
    sessionAuthority,
    tokenAuthority,
    emitterAccount,
    wormholeMessageAccount,
    peerAccount,
    transceiverPeerAccount,
    transceiverMessageAccount,
    registeredTransceiver,
  };
};

//
