// import {
//   ChainAddress,
//   ChainConfig,
//   ChainContext,
//   Platform,
//   Signer,
//   WormholeConfig,
//   nativeChainAddress,
// } from "@wormhole-foundation/sdk-connect";
//
// import { getCosmwasmSigner } from "@wormhole-foundation/sdk-cosmwasm";
// import { getEvmSigner } from "@wormhole-foundation/sdk-evm";
// import { getSolanaSigner } from "@wormhole-foundation/sdk-solana";
//
// import { ETH_PRIVATE_KEY, SOLANA_PRIVATE_KEY, TERRA_PRIVATE_KEY } from "./consts";
//
// export interface SignerStuff {
//   chain: ChainContext<Platform>;
//   signer: Signer;
//   address: ChainAddress;
// }
//
// export async function getSigner(
//   chain: ChainContext<Platform>,
// ): Promise<SignerStuff> {
//   let signer: Signer;
//   switch (chain.platform.platform) {
//     case "Solana":
//       signer = await getSolanaSigner(await chain.getRpc(), SOLANA_PRIVATE_KEY);
//       break;
//     case "Cosmwasm":
//       signer = await getCosmwasmSigner(await chain.getRpc(), TERRA_PRIVATE_KEY);
//       break;
//     default:
//       signer = await getEvmSigner(await chain.getRpc(), ETH_PRIVATE_KEY);
//   }
//
//   return { chain, signer, address: nativeChainAddress(signer) };
// }
//
//
// export type ConfigOverride = {
//   [key: string]: Partial<ChainConfig>
// }
// export function overrideChainSetting(config: WormholeConfig, overrides: ConfigOverride): WormholeConfig {
//   for (const [cn, oride] of Object.entries(overrides)) {
//     // @ts-ignore
//     config.chains[cn] = { ...config.chains[cn], ...oride }
//   }
//   return config
// }
//
