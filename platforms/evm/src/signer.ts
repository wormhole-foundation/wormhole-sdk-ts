import { Signer, ChainName, SignOnlySigner, SignedTx, UnsignedTransaction } from "@wormhole-foundation/connect-sdk";
import { ethers } from "ethers";


export async function getEvmSigner(
    chain: ChainName,
    provider: ethers.Provider,
    privateKey: string,
): Promise<Signer> {
    return new EvmSigner(chain, provider, privateKey);
}



// EvmSigner implements SignOnlySender
export class EvmSigner implements SignOnlySigner {
    _wallet: ethers.Wallet;

    constructor(
        private _chain: ChainName,
        private provider: ethers.Provider,
        privateKey: string,
    ) { this._wallet = new ethers.Wallet(privateKey, provider); }

    chain(): ChainName {
        return this._chain;
    }

    address(): string {
        return this._wallet.address;
    }

    async sign(tx: UnsignedTransaction[]): Promise<SignedTx[]> {
        const signed = [];

        let nonce = await this.provider.getTransactionCount(this.address())

        // TODO: Better gas estimation/limits
        let gasLimit = 500_000n;
        let maxFeePerGas = 1_500_000_000n; // 1.5gwei
        let maxPriorityFeePerGas = 100_000_000n; // 0.1gwei

        // Celo does not support this call
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
                    gasLimit,
                    maxFeePerGas,
                    maxPriorityFeePerGas,
                    nonce,
                },
            };
            signed.push(await this._wallet.signTransaction(t));

            nonce += 1;
        }
        return signed;
    }
}