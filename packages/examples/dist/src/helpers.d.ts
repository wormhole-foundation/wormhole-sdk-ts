import { ethers } from "ethers";
import { Keypair } from "@solana/web3.js";
export declare function getSolSigner(): Keypair;
export declare function getEthSigner(provider: ethers.providers.Provider): ethers.Wallet;
