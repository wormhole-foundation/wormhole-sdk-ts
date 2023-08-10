import { TokenId } from '../../types.js';

/**
 * @abstract
 *
 * Methods that must be implemented by the Solana Context
 */
export abstract class SolanaAbstract {
  abstract getAssociatedTokenAddress(
    token: TokenId,
    account: any,
  ): Promise<any>;
}
