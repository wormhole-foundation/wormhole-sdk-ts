import { ChainName, SignOnlySigner, SignedTx, UnsignedTransaction } from "@wormhole-foundation/connect-sdk";
import { ethers } from "ethers";

// EvmSigner implements SignOnlySender
export class EvmSigner implements SignOnlySigner {
    constructor(
        private _chain: ChainName,
        private _wallet: ethers.Wallet,
        private nonce: number,
        private provider: ethers.Provider,
    ) { }
    chain(): ChainName {
        return this._chain;
    }
    address(): string {
        return this._wallet.address;
    }
    async sign(tx: UnsignedTransaction[]): Promise<SignedTx[]> {
        const signed = [];

        // TODO
        let maxFeePerGas = 1_500_000_000n; // 1.5gwei
        let maxPriorityFeePerGas = 100_000_000n; // 0.1gwei
        if (this._chain !== "Celo") {
            const feeData = await this.provider.getFeeData();
            maxFeePerGas = feeData.maxFeePerGas ?? maxFeePerGas;
            maxPriorityFeePerGas =
                feeData.maxPriorityFeePerGas ?? maxPriorityFeePerGas;
        }

        for (const txn of tx) {
            const { transaction, description } = txn;
            console.log(`Signing: ${description} for ${this.address()}`);

            const t: ethers.TransactionRequest = {
                ...transaction,
                ...{
                    gasLimit: 500_000n,
                    maxFeePerGas,
                    maxPriorityFeePerGas,
                    nonce: this.nonce,
                },
            };
            signed.push(await this._wallet.signTransaction(t));
            // TODO:
            this.nonce += 1;
        }
        return signed;
    }
}