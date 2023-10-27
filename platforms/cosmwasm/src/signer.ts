import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { AccountData } from "@cosmjs/proto-signing";
import { ChainName, PlatformToChains, SignOnlySigner, SignedTx, UnsignedTransaction, encoding } from "@wormhole-foundation/connect-sdk";
import { CosmwasmUnsignedTransaction } from "./unsignedTransaction";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import {
    ChainRestAuthApi,
    DEFAULT_STD_FEE,
    MsgExecuteContract,
    Msgs,
    PrivateKey,
    TxClient,
    createTransaction,
} from "@injectivelabs/sdk-ts";
import { chainToAddressPrefix } from "./constants";

export class CosmwasmSigner implements SignOnlySigner {
    constructor(
        private _chain: ChainName,
        private _signer: SigningCosmWasmClient,
        private _account: AccountData,
    ) { }

    chain(): ChainName {
        return this._chain;
    }

    address(): string {
        return this._account.address;
    }

    async sign(tx: UnsignedTransaction[]): Promise<SignedTx[]> {
        const signed = [];
        for (const txn of tx) {
            const { description, transaction } = txn as CosmwasmUnsignedTransaction;
            console.log(`Signing: ${description} for ${this.address()}`);

            const txRaw = await this._signer.sign(
                this.address(),
                transaction.msgs,
                transaction.fee,
                transaction.memo,
            );

            const encoded = TxRaw.encode(txRaw).finish();
            signed.push(encoded);
        }

        return signed;
    }
}


export class CosmwasmEvmSigner implements SignOnlySigner {
    private key: PrivateKey;
    private prefix: string;
    constructor(
        private _chain: ChainName,
        private _chainId: string,
        private _mnemonic: string,
        private _rpc: ChainRestAuthApi,
    ) {
        this.prefix = chainToAddressPrefix(_chain as PlatformToChains<"Cosmwasm">);
        this.key = PrivateKey.fromMnemonic(_mnemonic);
    }

    chain() {
        return this._chain;
    }

    address() {
        return this.key.toAddress().toBech32(this.prefix);
    }

    async sign(txns: UnsignedTransaction[]): Promise<SignedTx[]> {
        const pubKey = this.key.toPublicKey().toBase64();
        const { sequence, accountNumber } = await this.getSignerData();

        const signed: SignedTx[] = [];
        for (const tx of txns) {
            const { description, transaction } = tx as CosmwasmUnsignedTransaction;
            console.log(`Signing ${description} for ${this.address()}`);

            // need to set contractAddress and msg
            const message: Msgs[] = transaction.msgs.map((m) => {
                const f = {
                    ...m.value,
                    msg: JSON.parse(encoding.fromUint8Array(m.value.msg)),
                    contractAddress: m.value.contract,
                };
                return new MsgExecuteContract(f);
            });

            console.log(message);

            const { signBytes, txRaw } = createTransaction({
                message,
                pubKey,
                sequence,
                accountNumber,
                chainId: this._chainId,
                memo: transaction.memo,
                fee: DEFAULT_STD_FEE,
            });
            // @ts-ignore -- sign wants a `Buffer` but we give it uint8array
            txRaw.signatures = [await this.key.sign(signBytes)];
            signed.push(encoding.b64.decode(TxClient.encode(txRaw)));
        }

        return signed;
    }

    async getSignerData(): Promise<{
        address: string;
        sequence: number;
        accountNumber: number;
    }> {
        const address = this.address();
        const { account } = await this._rpc.fetchAccount(address);
        const accountNumber = parseInt(account.base_account.account_number, 10);
        const sequence = parseInt(account.base_account.sequence, 10);
        return { address, sequence, accountNumber };
    }
}
