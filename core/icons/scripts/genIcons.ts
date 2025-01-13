// This file generates chainIcons.ts
// Usage: npm run gen

import { readFileSync, writeFileSync } from "fs";
import { Chain, chains, encoding } from "@wormhole-foundation/sdk-base";

let output = `
// THIS FILE IS AUTO-GENERATED WITH \`npm run gen\`

import { Chain } from "@wormhole-foundation/sdk-base";

const PREFIX = "data:image/svg+xml;base64,"

export function chainToIcon(chain: Chain): string {`;

const makeChainCondition = (chain: Chain): string => {
  if (chain === "Ethereum") {
    return `(chain === "Ethereum" || chain === "Sepolia" || chain === "Holesky")`;
  } else if (chains.includes(`${chain}Sepolia` as Chain)) {
    // as to avoid the type error without re-typing the array
    return `(chain === "${chain}" || chain === "${chain}Sepolia")`;
  } else if (chain === "Sei") {
    return `(chain === "${chain}" || chain === "${chain}evm")`;
  } else if (chain === "Monad") {
    return `(chain === "${chain}" || chain === "${chain}Devnet")`;    
  } else if (chain.includes("Sepolia") || chain.includes("Holesky") || chain === "Seievm" || chain === "MonadDevnet") {
    return "";
  } else {
    return `(chain === "${chain}")`;
  }
};

let first = true;
for (const chain of chains) {
  const condition = makeChainCondition(chain);
  if (condition) {
    const svg = readFileSync(`./src/images/chains/${chain}.svg`, "utf-8")
      .replace(/\r\n/g, "\n")
      .replace(/\n/g, "");
    const b64 = encoding.b64.encode(svg);
    if (first) {
      output += `
  if ${condition} {
    return PREFIX+"${b64}"`;
      first = false;
    } else {
      output += `
  } else if ${condition} {
    return PREFIX+"${b64}"`;
    }
  }
}

// the ternary avoids the not used lint error =\
output += `
  } else {
    // This case is never reached
    const _: never = chain;
    return _ ? "" : "";
  }
}
`;

writeFileSync("./src/constants/chainIcons.ts", output);
