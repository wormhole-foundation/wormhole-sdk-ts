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
  Signer as EthersSigner,
  Provider,
  TransactionRequest,
} from 'ethers';
import { NonceManager, Wallet } from 'ethers';
import { EvmPlatform } from './platform.js';
import type { EvmChains } from './types.js';
import { _platform } from './types.js';

export async function getEvmSigner(
  rpc: Provider,
  key: string | EthersSigner,
  opts?: {
    maxGasLimit?: bigint;
    chain?: EvmChains;
    debug?: boolean;
  },
): Promise<Signer> {
  const signer: EthersSigner =
    typeof key === 'string' ? new Wallet(key, rpc) : key;

  const chain = opts?.chain ?? (await EvmPlatform.chainFromRpc(rpc))[1];
  const managedSigner = new NonceManager(signer);

  if (managedSigner.provider === null) {
    try {
      managedSigner.connect(rpc);
    } catch (e) {
      console.error('Cannot connect to network for signer', e);
    }
  }

  return new EvmNativeSigner(
    chain,
    await signer.getAddress(),
    managedSigner,
    opts,
  );
}

// Get a SignOnlySigner for the EVM platform
export async function getEvmSignerForKey(
  rpc: Provider,
  privateKey: string,
): Promise<Signer> {
  return getEvmSigner(rpc, privateKey);
}

// Get a SignOnlySigner for the EVM platform
export async function getEvmSignerForSigner(
  signer: EthersSigner,
): Promise<Signer> {
  if (!signer.provider) throw new Error('Signer must have a provider');
  return getEvmSigner(signer.provider!, signer, {});
}

export class EvmNativeSigner<N extends Network, C extends EvmChains = EvmChains>
  extends PlatformNativeSigner<EthersSigner, N, C>
  implements SignOnlySigner<N, C>
{
  constructor(
    _chain: C,
    _address: string,
    _signer: EthersSigner,
    readonly opts?: { maxGasLimit?: bigint; debug?: boolean },
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
    const chain = this.chain();

    const signed = [];

    // default gas limit
    const gasLimit = this.opts?.maxGasLimit ?? 500_000n;

    let gasPrice = 100_000_000_000n; // 100gwei
    let maxFeePerGas = 1_500_000_000n; // 1.5gwei
    let maxPriorityFeePerGas = 100_000_000n; // 0.1gwei

    // Celo does not support this call
    if (chain !== 'Celo') {
      const feeData = await this._signer.provider!.getFeeData();
      gasPrice = feeData.gasPrice ?? gasPrice;
      maxFeePerGas = feeData.maxFeePerGas ?? maxFeePerGas;
      maxPriorityFeePerGas =
        feeData.maxPriorityFeePerGas ?? maxPriorityFeePerGas;
    }

    // Oasis throws malformed errors unless we
    // set it to use legacy transaction parameters
    const gasOpts =
      chain === 'Oasis'
        ? {
            gasLimit,
            gasPrice: gasPrice,
            // Hardcode type
            type: 0,
          }
        : {
            maxFeePerGas,
            maxPriorityFeePerGas,
            gasLimit,
          };

    for (const txn of tx) {
      const { transaction, description } = txn;
      if (this.opts?.debug)
        console.log(`Signing: ${description} for ${this.address()}`);

      const t: TransactionRequest = {
        ...transaction,
        ...gasOpts,
        from: this.address(),
        nonce: await this._signer.getNonce(),
      };

      // try {
      //   const estimate = await this._signer.provider!.estimateGas(t);
      //   t.gasLimit = estimate + estimate / 10n; // Add 10% buffer
      //   if (this.opts?.maxGasLimit && t.gasLimit > this.opts?.maxGasLimit) {
      //     throw new Error(
      //       `Gas limit ${t.gasLimit} exceeds maxGasLimit ${this.opts?.maxGasLimit}`,
      //     );
      //   }
      // } catch (e) {
      //   console.info('Failed to estimate gas for transaction: ', e);
      //   console.info('Using gas limit: ', t.gasLimit);
      // }

      signed.push(await this._signer.signTransaction(t));
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
