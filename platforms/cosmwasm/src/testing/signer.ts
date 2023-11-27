import { CosmWasmClient, SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import {
  ChainRestAuthApi,
  DEFAULT_STD_FEE,
  MsgExecuteContract,
  Msgs,
  PrivateKey,
  TxClient,
  createTransaction,
} from "@injectivelabs/sdk-ts";
import {
  Network,
  PlatformToChains,
  SignOnlySigner,
  SignedTx,
  Signer,
  UnsignedTransaction,
  encoding,
  nativeChainIds,
  rpc as rpcConf,
} from "@wormhole-foundation/connect-sdk";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import {
  CosmwasmEvmChain,
  chainToAddressPrefix,
  cosmwasmNetworkChainToRestUrls,
  evmLikeChains,
} from "../constants";
import { CosmwasmPlatform } from "../platform";
import { CosmwasmChains } from "../types";
import { CosmwasmUnsignedTransaction } from "../unsignedTransaction";

export async function getCosmwasmSigner(rpc: CosmWasmClient, mnemonic: string): Promise<Signer> {
  const [network, chain] = await CosmwasmPlatform.chainFromRpc(rpc);

  // Use the EVM signer for Evmos and Injective only
  if (evmLikeChains.includes(chain as CosmwasmEvmChain)) {
    return new CosmwasmEvmSigner(chain, network, mnemonic);
  }

  // Otherwise use the default signer
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: chainToAddressPrefix(chain as PlatformToChains<"Cosmwasm">),
  });

  const acct = (await signer.getAccounts())[0]!;
  const signingClient = await SigningCosmWasmClient.connectWithSigner(
    rpcConf.rpcAddress(network, chain)!,
    signer,
  );

  return new CosmwasmSigner(chain, signingClient, acct.address);
}

export class CosmwasmSigner<N extends Network, C extends CosmwasmChains>
  implements SignOnlySigner<N, C>
{
  constructor(
    private _chain: C,
    private _signer: SigningCosmWasmClient,
    private _account: string,
  ) {}

  chain(): C {
    return this._chain;
  }

  address(): string {
    return this._account;
  }

  async sign(tx: UnsignedTransaction[]): Promise<SignedTx[]> {
    const signed = [];
    for (const txn of tx) {
      const { description, transaction } = txn as CosmwasmUnsignedTransaction<N, C>;
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

export class CosmwasmEvmSigner<N extends Network, C extends CosmwasmChains>
  implements SignOnlySigner<N, C>
{
  private _chainId: string;
  private key: PrivateKey;
  private prefix: string;
  private _rpc: ChainRestAuthApi;
  constructor(
    private _chain: C,
    _network: Network,
    _mnemonic: string,
  ) {
    this._rpc = new ChainRestAuthApi(
      cosmwasmNetworkChainToRestUrls(_network, _chain as CosmwasmEvmChain),
    );

    this._chainId = nativeChainIds.networkChainToNativeChainId(
      _network,
      _chain as CosmwasmEvmChain,
    );

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
      const { description, transaction } = tx as CosmwasmUnsignedTransaction<N, C>;
      console.log(`Signing ${description} for ${this.address()}`);

      // need to set contractAddress and msg
      const message: Msgs[] = transaction.msgs.map((m) => {
        const f = {
          ...m.value,
          msg: JSON.parse(encoding.bytes.decode(m.value.msg)),
          contractAddress: m.value.contract,
        };
        return new MsgExecuteContract(f);
      });

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
