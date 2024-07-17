import type { Layout, LayoutToType } from '@wormhole-foundation/sdk-connect';
import {
  deserializeLayout,
  layoutItems,
} from '@wormhole-foundation/sdk-connect';

/** Binary layout for postMessage account */
export const postMessageLayout = [
  { name: 'discriminator', binary: 'bytes', size: 4 },
  { name: 'consistencyLevel', binary: 'uint', size: 1, endianness: 'little' },
  { name: 'emitterAuthority', ...layoutItems.universalAddressItem },
  { name: 'messageStatus', binary: 'uint', size: 1, endianness: 'little' },
  { name: 'gap', binary: 'uint', size: 3 },
  { name: 'timestamp', binary: 'uint', size: 4, endianness: 'little' },
  { name: 'nonce', binary: 'uint', size: 4, endianness: 'little' },
  { name: 'sequence', binary: 'uint', size: 8, endianness: 'little' },
  { name: 'emitterChain', binary: 'uint', size: 2, endianness: 'little' },
  { name: 'emitterAddress', ...layoutItems.universalAddressItem },
  { name: 'payloadLength', binary: 'uint', size: 4, endianness: 'little' },
  { name: 'payload', binary: 'bytes' },
] as const satisfies Layout;

export function deserializePostMessage(
  data: Uint8Array,
): LayoutToType<typeof postMessageLayout> {
  return deserializeLayout(postMessageLayout, data);
}
