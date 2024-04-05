import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import { filters } from "@wormhole-foundation/sdk-base";
import { type TokenSymbol } from "@wormhole-foundation/sdk-base";
import type { ChainContext, TokenId } from "@wormhole-foundation/sdk-definitions";
import { canonicalAddress, isNative } from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../wormhole.js";

export interface TokenDetails {
  id: TokenId;
  decimals: number;
  symbol?: TokenSymbol;
  wrapped?: TokenId;
}

export function uniqueTokens<C extends Chain>(tokens: TokenId<C>[]): TokenId<C>[] {
  if (tokens.length === 0) return [];

  // take the first chain, all should be equal
  const { chain } = tokens[0]!;
  if (!tokens.every((t) => t.chain === chain)) throw new Error("Not every chain is equal");

  return Array.from(new Set(tokens.map((t) => canonicalAddress(t)))).map((a) =>
    Wormhole.tokenId(chain, a),
  );
}

export function tokenAddresses(tokens: TokenId[]): string[] {
  return tokens.map((t) => canonicalAddress(t));
}

export async function getTokenDetails<N extends Network>(
  chain: ChainContext<N>,
  token: TokenId,
): Promise<TokenDetails> {
  const address = canonicalAddress(token);

  const details = chain.config.tokenMap
    ? filters.byAddress(chain.config.tokenMap!, address)
    : undefined;

  const symbol = details ? details.symbol : undefined;
  const wrapped = isNative(token.address) ? await chain.getNativeWrappedTokenId() : undefined;
  const decimals = Number(await chain.getDecimals(token.address));

  return {
    id: token,
    decimals,
    wrapped,
    symbol,
  };
}
