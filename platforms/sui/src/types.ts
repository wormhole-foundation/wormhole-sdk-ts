import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui.js";
import { PlatformToChains, UniversalOrNative } from "@wormhole-foundation/connect-sdk";

export const _platform: "Sui" = "Sui";
export type SuiPlatformType = typeof _platform;

export type SuiChains = PlatformToChains<SuiPlatformType>;
export type UniversalOrSui = UniversalOrNative<SuiChains>;
export type AnySuiAddress = UniversalOrSui | string | Uint8Array;

export type CurrentCoinBalancesResponse = {
  data: { current_coin_balances: CoinBalance[] };
};

export type CoinBalance = {
  coin_type: string;
  amount: number;
};

export type SuiBuildOutput = {
  modules: string[];
  dependencies: string[];
};

export type SuiError = {
  code: number;
  message: string;
  data: any;
};

export type SuiCoinObject = {
  coinType: string;
  coinObjectId: string;
};

/**
 * Test if given string is a valid fully qualified type of moduleAddress::moduleName::structName.
 * @param str String to test
 * @returns Whether or not given string is a valid type
 */
export const isValidSuiType = (str: string): boolean => /^(0x)?[0-9a-fA-F]+::\w+::\w+$/.test(str);

/**
 * This method removes leading zeroes for types in order to normalize them
 * since some types returned from the RPC have leading zeroes and others don't.
 */
export const trimSuiType = (type: string): string => type.replace(/(0x)(0*)/g, "0x");

export const normalizeSuiType = (type: string): string => {
  const tokens = type.split("::");
  if (tokens.length !== 3 || !isValidSuiAddress(tokens[0]!)) {
    throw new Error(`Invalid Sui type: ${type}`);
  }

  return [normalizeSuiAddress(tokens[0]), tokens[1], tokens[2]].join("::");
};

export const isSameType = (a: string, b: string) => {
  try {
    return normalizeSuiType(a) === normalizeSuiType(b);
  } catch (e) {
    return false;
  }
};

/**
 * Returns module address from given fully qualified type/module address.
 * @param str FQT or module address
 * @returns Module address
 */
export const coalesceModuleAddress = (str: string): string => str.split("::")[0]!;
