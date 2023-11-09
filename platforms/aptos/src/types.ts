import { PlatformToChains, UniversalOrNative } from "@wormhole-foundation/connect-sdk";

export const unusedNonce = 0;
export const unusedArbiterFee = 0n;

export type AptosChainName = PlatformToChains<"Aptos">;
export type UniversalOrAptos = UniversalOrNative<"Aptos">;
export type AnyAptosAddress = UniversalOrAptos | string | Uint8Array;

export type CurrentCoinBalancesResponse = {
  data: { current_coin_balances: CoinBalance[] };
};

export type CoinBalance = {
  coin_type: string;
  amount: number;
};

/**
 * Test if given string is a valid fully qualified type of moduleAddress::moduleName::structName.
 * @param str String to test
 * @returns Whether or not given string is a valid type
 */
export const isValidAptosType = (str: string): boolean => /^(0x)?[0-9a-fA-F]+::\w+::\w+$/.test(str);

/**
 * Returns module address from given fully qualified type/module address.
 * @param str FQT or module address
 * @returns Module address
 */
export const coalesceModuleAddress = (str: string): string => str.split("::")[0];
