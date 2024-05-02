# Wormhole Icons

This package contains icons for all of the Wormhole connected [chains](https://docs.wormhole.com/wormhole/reference/blockchain-environments).

## Installation

### Basic

Install this package

```bash
npm install @wormhole-foundation/sdk-icons
```

## Usage

Getting started is simple, just import Wormhole and the [Platform](#platforms) modules you wish to support

```ts
import { Chain } from "@wormhole-foundation/sdk-base";
import { chainToIcon } from "@wormhole-foundation/sdk-icons";

function ChainIcon({chain}: {chain: Chain}) {
    const icon = chainToIcon(chain);
    return icon ? <img src={icon} alt={chain} height="32px" width="32px" /> : null
}
```

## Development

SVGs for each chain should be included only _once_ in `src/images/chains` and they should be minified using a tool like [SVGOMG](https://jakearchibald.github.io/svgomg/) to reduce the overall bundle size.

When a new chain is added, the strict typing should enforce that this package must be updated. In most cases, this should be as simple as dropping the SVG in `/src/images/chains` and running `npm run gen`
