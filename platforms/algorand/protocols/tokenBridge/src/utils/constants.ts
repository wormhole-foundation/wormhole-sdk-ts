import {
  isChain,
  ChainId,
  ChainName,
  toChainId,
  Network,
  toChainName,
} from '@wormhole-foundation/connect-sdk';

export const SEED_AMT: number = 1002000;

const MAX_KEYS: number = 15;
const MAX_BYTES_PER_KEY: number = 127;
const BITS_PER_BYTE: number = 8;

export const BITS_PER_KEY: number = MAX_BYTES_PER_KEY * BITS_PER_BYTE;
const MAX_BYTES: number = MAX_BYTES_PER_KEY * MAX_KEYS;
export const MAX_BITS: number = BITS_PER_BYTE * MAX_BYTES;

export const MAX_SIGS_PER_TXN: number = 6;

export const ALGO_VERIFY_HASH =
  'EZATROXX2HISIRZDRGXW4LRQ46Z6IUJYYIHU3PJGP7P5IQDPKVX42N767A';

export const ALGO_VERIFY = new Uint8Array([
  6, 32, 4, 1, 0, 32, 20, 38, 1, 0, 49, 32, 50, 3, 18, 68, 49, 1, 35, 18, 68,
  49, 16, 129, 6, 18, 68, 54, 26, 1, 54, 26, 3, 54, 26, 2, 136, 0, 3, 68, 34,
  67, 53, 2, 53, 1, 53, 0, 40, 53, 240, 40, 53, 241, 52, 0, 21, 53, 5, 35, 53,
  3, 35, 53, 4, 52, 3, 52, 5, 12, 65, 0, 68, 52, 1, 52, 0, 52, 3, 129, 65, 8,
  34, 88, 23, 52, 0, 52, 3, 34, 8, 36, 88, 52, 0, 52, 3, 129, 33, 8, 36, 88, 7,
  0, 53, 241, 53, 240, 52, 2, 52, 4, 37, 88, 52, 240, 52, 241, 80, 2, 87, 12,
  20, 18, 68, 52, 3, 129, 66, 8, 53, 3, 52, 4, 37, 8, 53, 4, 66, 255, 180, 34,
  137,
]);

export const ZERO_PAD_BYTES =
  '0000000000000000000000000000000000000000000000000000000000000000';

// Address of the xALGO token on Algorand
// TODO: Find a better way to provide this information
export function getXAlgoNative(network: Network) {
  if (network === 'Mainnet') {
    return '1134696561';
  } else if (network === 'Testnet') {
    return '235544455';
  } else {
    throw new Error('xALGO not on Devnet');
  }
}

export function coalesceChainId(chain: ChainId | ChainName): ChainId {
  // this is written in a way that for invalid inputs (coming from vanilla
  // javascript or someone doing type casting) it will always return undefined.
  return typeof chain === 'number' && isChain(toChainName(chain))
    ? chain
    : toChainId(chain);
}
