import { Chain, Network, tokens } from "@wormhole-foundation/sdk-base";
import { TokenId } from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../../wormhole";

// For a given token, return the corresponding
// Wormhole wrapped token that originated on Ethereum
export const getTransferrableToken = <N extends Network>(
  network: N,
  chain: Chain,
  address: string,
): TokenId => {
  if (chain === "Ethereum") return Wormhole.chainAddress("Ethereum", address);

  // get the nativeTokenDetails
  const nToken = tokens.getTokenByAddress(network, chain, address);
  if (!nToken) throw new Error("Unsupported source token: " + address);

  // find the same token by symbol with an origin of Ethereum
  // this is the token we standardize for transfer
  const xToken = tokens.getTokensBySymbol(network, chain, nToken.symbol)?.find((orig) => {
    return orig.original === "Ethereum";
  });
  if (!xToken) throw new Error(`Unsupported symbol for chain ${nToken.symbol}: ${chain} `);

  return Wormhole.chainAddress(xToken.chain, xToken.address);
};
