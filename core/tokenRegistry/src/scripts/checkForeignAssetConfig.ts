// patch out annoying logs
const info = console.info;
console.info = function (x: any, ...rest: any) {
  if (x !== 'secp256k1 unavailable, reverting to browser version') {
    info(x, ...rest);
  }
};
const warn = console.warn;
console.warn = function (x: any, ...rest: any) {
  if (
    !x
      .toString()
      .startsWith(
        'Error: Error: RPC Validation Error: The response returned from RPC server does not match the TypeScript definition. This is likely because the SDK version is not compatible with the RPC server.',
      )
  ) {
    warn(x, ...rest);
  }
};

import { ChainName, Network, PlatformName, chainToPlatform, chains } from "@wormhole-foundation/sdk-base";
import { ForeignAssetsCache, TokensConfig } from "../types";
import { TESTNET_TOKENS } from "../tokens/testnetTokens";
import { TokenId, Wormhole, toNative } from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

// TODO: How do we handle if a user tries to perform an action for a chain/platform which isn't installed??
const supportedPlatforms: PlatformName[] = ['Evm', 'Solana'];

const isSupportedPlatform = (chain: ChainName) => {
  const platform = chainToPlatform(chain);
  return supportedPlatforms.includes(platform);
}

const createTokenId = (chain: ChainName, address: string) => {
  if (!isSupportedPlatform(chain)) return;
  return {
    chain,
    address: toNative(chain, address),
  }
}

// warning: be careful optimizing the RPC calls in this script, you may 429 yourself
// slow and steady, or something like that
const checkEnvConfig = async (
  env: Network,
  tokensConfig: TokensConfig,
) => {
  const wh = new Wormhole(env, [EvmPlatform, SolanaPlatform])

  const getForeignAddress = async (chain: ChainName, tokenId: TokenId) => {
    if (!isSupportedPlatform(chain)) return;
    let foreignAddress: string | null = null;
    try {
      const foreignId = await wh.getWrappedAsset(chain, tokenId);
      foreignAddress = foreignId.address.toString();
    } catch (e: any) {
      if (
        e?.message === '3104 RPC not configured' ||
        e?.message === 'wormchain RPC not configured'
      ) {
        // do not throw on wormchain errors
      } else {
        // silence Not a wrapped asset error
        // throw e;
        // console.log(e)
      }
    }
    return foreignAddress;
  }

  const getForeignAssetsData = async (chain: ChainName, tokenId: TokenId | undefined, foreignAssetsCache: ForeignAssetsCache | undefined) => {
    if (!tokenId) return;
    for (const foreignChain of chains) {
      const isSupported = isSupportedPlatform(foreignChain);
      if (foreignChain !== tokenId.chain && isSupported) {
        console.log('FOREIGN CHAIN', foreignChain)
        const configForeignAddress = foreignAssetsCache ? foreignAssetsCache[foreignChain] : undefined;
        const foreignAddress = await getForeignAddress(chain, tokenId);
        console.log(foreignAddress)
        if (foreignAddress) {
          const foreignDecimals = await wh.getDecimals(
            chain,
            tokenId,
          );
          console.log('FOREIGN', foreignAddress, foreignDecimals)
          if (configForeignAddress) {
            if (configForeignAddress.address !== foreignAddress) {
              throw new Error(
                `❌ Invalid foreign address detected! Env: ${wh.conf.network}, Existing Address: ${configForeignAddress.address}, Chain: ${chain}, Expected: ${foreignAddress}, Received: ${configForeignAddress.address}`,
              );
            } else if (BigInt(configForeignAddress.decimals) !== foreignDecimals) {
              throw new Error(
                `❌ Invalid foreign decimals detected! Env: ${wh.conf.network}, Existing Address: ${configForeignAddress.address}, Chain: ${chain}, Expected: ${foreignDecimals}, Received: ${configForeignAddress.decimals}`,
              );
            } else {
              console.log('✅ Config matches');
            }
          }
        }
      }
    }
  }

  for (const [chain, chainTokensConfig] of Object.entries(tokensConfig)) {
    console.log(`--------CHAIN--------\n${chain}\n`)
    for (const [token, config] of Object.entries(chainTokensConfig)) {
      const tokenId = createTokenId(chain as ChainName, token);
      await getForeignAssetsData(chain as ChainName, tokenId, config.foreignAssets);
    }
  }
}

(async () => {
  await checkEnvConfig('Testnet', TESTNET_TOKENS);
})();
