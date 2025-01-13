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
  [    3, "Terra"          ],
  [    4, "Bsc"            ],
  [    5, "Polygon"        ],
  [    6, "Avalanche"      ],
  [    7, "Oasis"          ],
  [    8, "Algorand"       ],
  [    9, "Aurora"         ],
  [   10, "Fantom"         ],
  [   11, "Karura"         ],
  [   12, "Acala"          ],
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
  [   28, "Xpla"           ],
  [   29, "Btc"            ],
  [   30, "Base"           ],
  [   32, "Sei"            ],
  [   33, "Rootstock"      ],
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
  [10008, "MonadDevnet"    ],
] as const satisfies MapLevel<number, string>;

export const [chainIds, chains] = zip(chainIdAndChainEntries);
export type Chain = (typeof chains)[number];
export type ChainId = (typeof chainIds)[number];

export const chainToChainId = constMap(chainIdAndChainEntries, [1, 0]);
export const chainIdToChain = constMap(chainIdAndChainEntries);

export const isChain = (chain: string): chain is Chain => chainToChainId.has(chain);
export const isChainId = (chainId: number): chainId is ChainId => chainIdToChain.has(chainId);

export function assertChainId(chainId: number): asserts chainId is ChainId {
  if (!isChainId(chainId)) throw Error(`Unknown Wormhole chain id: ${chainId}`);
}

export function assertChain(chain: string): asserts chain is Chain {
  if (!isChain(chain)) throw Error(`Unknown Wormhole chain: ${chain}`);
}

//safe assertion that allows chaining
export const asChainId = (chainId: number): ChainId => {
  assertChainId(chainId);
  return chainId;
};

export const toChainId = (chain: number | string): ChainId => {
  switch (typeof chain) {
    case "string":
      if (isChain(chain)) return chainToChainId(chain);
      break;
    case "number":
      if (isChainId(chain)) return chain;
      break;
  }
  throw Error(`Cannot convert to ChainId: ${chain}`);
};

export const toChain = (chain: number | string | bigint): Chain => {
  switch (typeof chain) {
    case "string":
      if (isChain(chain)) return chain;
      break;
    case "number":
      if (isChainId(chain)) return chainIdToChain(chain);
      break;
    case "bigint":
      if (isChainId(Number(chain))) return chainIdToChain.get(Number(chain))!;
      break;
  }
  throw Error(`Cannot convert to Chain: ${chain}`);
};
