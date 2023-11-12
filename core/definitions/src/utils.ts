//@noble is what ethers uses under the hood
import { sha256 } from "@noble/hashes/sha256";
import { keccak_256, sha3_256 } from "@noble/hashes/sha3";
import { sha512_256 } from "@noble/hashes/sha512";

export { keccak_256 as keccak256, sha3_256, sha256, sha512_256 };
