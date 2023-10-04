//@noble is what ethers uses under the hood
import { sha256 } from '@noble/hashes/sha256';
import { keccak_256 } from '@noble/hashes/sha3';

export { keccak_256 as keccak256, sha256 };
