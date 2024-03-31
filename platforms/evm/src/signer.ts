import type {
  Network,
  SignOnlySigner,
  SignedTx,
  Signer,
  UnsignedTransaction,
} from '@wormhole-foundation/sdk-connect';
import {
  PlatformNativeSigner,
  chainToPlatform,
  isNativeSigner,
} from '@wormhole-foundation/sdk-connect';
import type {
  Provider,
  Signer as EthersSigner,
  TransactionRequest,
} from 'ethers';
import { Wallet } from 'ethers';
import { EvmPlatform } from './platform.js';
import type { EvmChains } from './types.js';
import { _platform } from './types.js';
import { NonceManager } from 'ethers';

export async function getEvmSigner(
  signer: EthersSigner | { rpc: Provider; key: string },
  opts?: {
    maxGasLimit?: bigint;
  },
  chain?: EvmChains,
): Promise<Signer> {
  if (!isEthersSigner(signer)) {
    const { key, rpc } = signer;
    signer = new Wallet(key, rpc);
  }
  if (!chain) {
    const [, c] = await EvmPlatform.chainFromRpc(signer.provider!);
    chain = c;
  }

  signer = new NonceManager(signer);
  return new EvmNativeSigner(chain, await signer.getAddress(), signer, opts);
}

// Get a SignOnlySigner for the EVM platform
export async function getEvmSignerForKey(
  rpc: Provider,
  privateKey: string,
): Promise<Signer> {
  return getEvmSigner({ rpc, key: privateKey });
}

// Get a SignOnlySigner for the EVM platform
export async function getEvmSignerForSigner(
  chain: EvmChains,
  signer: EthersSigner,
): Promise<Signer> {
  return getEvmSigner(signer, {}, chain);
}

export class EvmNativeSigner<N extends Network, C extends EvmChains = EvmChains>
  extends PlatformNativeSigner<EthersSigner, N, C>
  implements SignOnlySigner<N, C>
{
  constructor(
    _chain: C,
    _address: string,
    _signer: EthersSigner,
    readonly opts?: { maxGasLimit?: bigint },
  ) {
    super(_chain, _address, _signer);
  }

  chain(): C {
    return this._chain;
  }

  address(): string {
    return this._address;
  }

  async sign(tx: UnsignedTransaction<N, C>[]): Promise<SignedTx[]> {
    const signed = [];

    // TODO: Better gas estimation/limits
    let maxFeePerGas = 1_500_000_000n; // 1.5gwei
    let maxPriorityFeePerGas = 100_000_000n; // 0.1gwei
    // Celo does not support this call
    if (this.chain() !== 'Celo') {
      const feeData = await this._signer.provider!.getFeeData();
      maxFeePerGas = feeData.maxFeePerGas ?? maxFeePerGas;
      maxPriorityFeePerGas =
        feeData.maxPriorityFeePerGas ?? maxPriorityFeePerGas;
    }

    let nonce = await this._signer.getNonce();
    for (const txn of tx) {
      const { transaction, description } = txn;
      console.log(`Signing: ${description} for ${this.address()}`);

      const t: TransactionRequest = {
        ...transaction,
        ...{
          maxFeePerGas,
          maxPriorityFeePerGas,
          nonce,
        },
      };

      const estimate = await this._signer.provider!.estimateGas(t);
      t.gasLimit = estimate + estimate / 10n; // Add 10% buffer
      if (this.opts?.maxGasLimit && t.gasLimit > this.opts?.maxGasLimit) {
        throw new Error(
          `Gas limit ${t.gasLimit} exceeds maxGasLimit ${this.opts?.maxGasLimit}`,
        );
      }

      signed.push(await this._signer.signTransaction(t));

      // assuming no nonce manager
      nonce += 1;
    }
    return signed;
  }
}

export function isEvmNativeSigner<N extends Network>(
  signer: Signer<N>,
): signer is EvmNativeSigner<N> {
  return (
    isNativeSigner(signer) &&
    chainToPlatform(signer.chain()) === _platform &&
    isEthersSigner(signer.unwrap())
  );
}

// No type guard provided by ethers, instanceof checks will fail on even slightly different versions of ethers
function isEthersSigner(thing: any): thing is EthersSigner {
  return (
    'provider' in thing &&
    typeof thing.connect === 'function' &&
    typeof thing.getAddress === 'function' &&
    typeof thing.getNonce === 'function' &&
    typeof thing.populateCall === 'function' &&
    typeof thing.populateTransaction === 'function' &&
    typeof thing.estimateGas === 'function' &&
    typeof thing.call === 'function' &&
    typeof thing.resolveName === 'function' &&
    typeof thing.signTransaction === 'function' &&
    typeof thing.sendTransaction === 'function' &&
    typeof thing.signMessage === 'function' &&
    typeof thing.signTypedData === 'function'
  );
}
