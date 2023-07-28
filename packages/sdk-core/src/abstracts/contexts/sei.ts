import { TokenId } from '../../types';

/**
 * @abstract
 *
 * Methods that must be implemented by the Sei Context
 */
export abstract class SeiAbstract {
  abstract buildSendPayload(
    token: TokenId | 'native',
    recipient: string,
  ): Promise<any>;
}
