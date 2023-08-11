# SDK Core

The primary component here is the Wormhole class, which serves as a wrapper for all the sdk methods.  It ensures that each chain implements certain methods with the same function signature and provides an interface for calling those methods easily.

## Getting started

Use this package in conjunction with 1 or more of the chain context packages (links provided below). It is divided this way in order to be more modular and light-weight, allowing you to import only the dependencies you actually need.

Getting started is simple, just import and pass in the contexts to the Wormhole class.

```ts
import { Wormhole, Context, Network } from '@wormhole-foundation/connect-sdk';
import { EvmContext } from '@wormhole-foundation/connect-sdk-evm';
import { SolanaContext } from '@wormhole-foundation/connect-sdk-solana';

const NETWORK = Network.MAINNET;
const contexts = {
  [Context.EVM]: EvmContext,
  [Context.SOLANA]: SolanaContext,
}
const wormholeSDK = new Wormhole(NETWORK, contexts);
const receipt = wormholeSDK.startTransfer(
  {
    chain: 'ethereum',
    address: '0x123...',
  }, // token id (native chain and address)
  new BigInt(10), // amount
  'ethereum', // sending chain
  '0x789...', // sender address
  'moonbeam', // destination chain
  '0x789...', // recipient address on destination chain
)
```

## Chain Context Packages

- [EVM](https://www.npmjs.com/package/@wormhole-foundation/connect-sdk-evm) (Ethereum, Polygon, Fantom, Moonbeam, Celo, Avalanche, BSC)
- [Aptos](https://www.npmjs.com/package/@wormhole-foundation/connect-sdk-aptos)
- [Solana](https://www.npmjs.com/package/@wormhole-foundation/connect-sdk-solana)
- [SUI](https://www.npmjs.com/package/@wormhole-foundation/connect-sdk-sui)

### Note WIP

Overall structure is subject to change.

Several components will be replaced over time.  Portions that will be changed:

1. `@certusone/wormhole-sdk` will be removed as a dependency from all packages
2. Contract interfaces will be imported from another package
3. Chain Config will be rewritten and imported from [1-base-layer](https://github.com/nonergodic/sdkv2/tree/main/1-base-layer)
4. Utils (`vaa`, `array`, `createNonce`, etc) will be rewritten and imported from [2-base-layer](https://github.com/nonergodic/sdkv2/tree/main/2-definition-layer)
