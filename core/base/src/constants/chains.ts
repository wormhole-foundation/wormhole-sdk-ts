import type { MapLevel } from "./../utils/index.js";
import { zip } from "./../utils/index.js";
import { constMap } from "../utils/mapping.js";

// prettier-ignore
const chainIdAndChainEntries = [
  //Unlike the old sdk, we are not including an "Unset" chain with chainId 0 here because:
  //  * no other types would be associated with it (such as contracts or a platform)
  //  * avoids awkward "chain but not 'Unset'" checks
  //  * "off" is not a TV channel either
  //Instead we'll use `null` for chain and 0 as the chainId where appropriate (e.g. governance VAAs)
  [    1, "Solana"         ],
  [    2, "Ethereum"       ],
  [    4, "Bsc"            ],
  [    5, "Polygon"        ],
  [    6, "Avalanche"      ],
  [    8, "Algorand"       ],
  [   10, "Fantom"         ],
  [   13, "Klaytn"         ],
  [   14, "Celo"           ],
  [   15, "Near"           ],
  [   16, "Moonbeam"       ],
  [   17, "Neon"           ],
  [   18, "Terra2"         ],
  [   19, "Injective"      ],
  [   20, "Osmosis"        ],
  [   21, "Sui"            ],
  [   22, "Aptos"          ],
  [   23, "Arbitrum"       ],
  [   24, "Optimism"       ],
  [   25, "Gnosis"         ],
  [   26, "Pythnet"        ],
  [   29, "Btc"            ],
  [   30, "Base"           ],
  [   32, "Sei"            ],
  [   34, "Scroll"         ],
  [   35, "Mantle"         ],
  [   36, "Blast"          ],
  [   37, "Xlayer"         ],
  [   38, "Linea"          ],
  [   39, "Berachain"      ],
  [   40, "Seievm"         ],
  [   43, "Snaxchain"      ],
  [   44, "Unichain"       ],
  [   45, "Worldchain"     ],
  [   46, "Ink"            ],
  [   47, "HyperEVM"       ],
  [   48, "Monad"          ],
  [   50, "Mezo"           ],
  [   51, "Fogo"           ],
  [   52, "Sonic"          ],
  [   53, "Converge"       ],
  [ 3104, "Wormchain"      ],
  [ 4000, "Cosmoshub"      ],
  [ 4001, "Evmos"          ],
  [ 4002, "Kujira"         ],
  [ 4003, "Neutron"        ],
  [ 4004, "Celestia"       ],
  [ 4005, "Stargaze"       ],
  [ 4006, "Seda"           ],
  [ 4007, "Dymension"      ],
  [ 4008, "Provenance"     ],
  [ 4009, "Noble"          ],
  [10002, "Sepolia"        ],
  [10003, "ArbitrumSepolia"],
  [10004, "BaseSepolia"    ],
  [10005, "OptimismSepolia"],
  [10006, "Holesky"        ],
  [10007, "PolygonSepolia" ],
] as const satisfies MapLevel<number, string>;

export const [chainIds, chains] = zip(chainIdAndChainEntries);

// Make Chain type more flexible to handle version mismatches
// Allow any string but provide autocomplete for known chains
export type Chain = (typeof chains)[number] | (string & {});
export type ChainId = (typeof chainIds)[number];

// Known chains for stricter internal use
export type KnownChain = (typeof chains)[number];

export const chainToChainId = constMap(chainIdAndChainEntries, [1, 0]);
export const chainIdToChain = constMap(chainIdAndChainEntries);

// Create an enum-like object for known chains
export const ChainName = Object.fromEntries(
  chainIdAndChainEntries.map(([id, name]) => [name, name])
) as { readonly [K in KnownChain]: K };

// More permissive type guards that still check known chains
export const isChain = (chain: string): chain is Chain => true;
export const isKnownChain = (chain: string): chain is KnownChain => chainToChainId.has(chain);
export const isChainId = (chainId: number): chainId is ChainId => chainIdToChain.has(chainId);

export function assertChainId(chainId: number): asserts chainId is ChainId {
  if (!isChainId(chainId)) throw Error(`Unknown Wormhole chain id: ${chainId}`);
}

export function assertChain(chain: string): asserts chain is Chain {
  // Now more permissive - any string is valid
  if (typeof chain !== "string" || chain.length === 0) {
    throw Error(`Invalid chain: ${chain}`);
  }
}

export function assertKnownChain(chain: string): asserts chain is KnownChain {
  if (!isKnownChain(chain)) throw Error(`Unknown Wormhole chain: ${chain}`);
}

//safe assertion that allows chaining
export const asChainId = (chainId: number): ChainId => {
  assertChainId(chainId);
  return chainId;
};

// ChainInput type for functions that accept either chain names or IDs
export type ChainInput = Chain | number;

// More flexible toChainId that accepts unknown chain IDs
export const toChainId = (chain: ChainInput): number => {
  switch (typeof chain) {
    case "string":
      // Try to map known chains to their IDs
      if (chainToChainId.has(chain)) return chainToChainId(chain as KnownChain);
      // For unknown chains, try to parse as number
      const parsed = parseInt(chain, 10);
      if (!isNaN(parsed)) return parsed;
      throw Error(`Cannot convert chain to ID: ${chain}`);
    case "number":
      return chain;
    default:
      throw Error(`Invalid chain input type: ${typeof chain}`);
  }
};

// More flexible toChain that preserves unknown chains
export const toChain = (chain: ChainInput | bigint): Chain => {
  switch (typeof chain) {
    case "string":
      return chain; // Any string is now valid
    case "number":
      // Try to map known chain IDs to names
      if (isChainId(chain)) return chainIdToChain(chain);
      // For unknown IDs, return as string
      return chain.toString();
    case "bigint":
      const num = Number(chain);
      if (isChainId(num)) return chainIdToChain.get(num)!;
      return chain.toString();
    default:
      throw Error(`Invalid chain input type: ${typeof chain}`);
  }
};
