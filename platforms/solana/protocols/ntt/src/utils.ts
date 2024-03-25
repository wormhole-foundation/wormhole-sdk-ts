import { PublicKey, PublicKeyInitData } from '@solana/web3.js';
import {
  Chain,
  ChainId,
  Ntt,
  encoding,
  keccak256,
  toChainId,
} from '@wormhole-foundation/sdk-connect';
import BN from 'bn.js';

export interface TransferArgs {
  amount: BN;
  recipientChain: { id: ChainId };
  recipientAddress: number[];
  shouldQueue: boolean;
}

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

const chainToBytes = (chain: Chain | ChainId) =>
  encoding.bignum.toBytes(toChainId(chain), 2);

// TODO: memoize?
export const nttAddresses = (programId: PublicKeyInitData) => {
  const configAccount = (): PublicKey => derivePda('config', programId);
  const emitterAccount = (): PublicKey => derivePda('emitter', programId);
  const inboxRateLimitAccount = (chain: Chain): PublicKey =>
    derivePda(['inbox_rate_limit', chainToBytes(chain)], programId);
  const inboxItemAccount = (chain: Chain, nttMessage: Ntt.Message): PublicKey =>
    derivePda(['inbox_item', Ntt.messageDigest(chain, nttMessage)], programId);
  const outboxRateLimitAccount = (): PublicKey =>
    derivePda('outbox_rate_limit', programId);
  const tokenAuthority = (): PublicKey =>
    derivePda('token_authority', programId);
  const peerAccount = (chain: Chain): PublicKey =>
    derivePda(['peer', chainToBytes(chain)], programId);
  const transceiverPeerAccount = (chain: Chain): PublicKey =>
    derivePda(['transceiver_peer', chainToBytes(chain)], programId);
  const registeredTransceiver = (transceiver: PublicKey): PublicKey =>
    derivePda(['registered_transceiver', transceiver.toBytes()], programId);
  const transceiverMessageAccount = (chain: Chain, id: Uint8Array): PublicKey =>
    derivePda(['transceiver_message', chainToBytes(chain), id], programId);
  const wormholeMessageAccount = (outboxItem: PublicKey): PublicKey =>
    derivePda(['message', outboxItem.toBytes()], programId);
  const sessionAuthority = (sender: PublicKey, args: TransferArgs): PublicKey =>
    derivePda(
      [
        'session_authority',
        sender.toBytes(),
        keccak256(
          encoding.bytes.concat(
            new Uint8Array(args.amount.toArrayLike(Buffer, 'be', 8)),
            chainToBytes(args.recipientChain.id),
            new Uint8Array(args.recipientAddress),
            new Uint8Array([args.shouldQueue ? 1 : 0]),
          ),
        ),
      ],
      programId,
    );

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
