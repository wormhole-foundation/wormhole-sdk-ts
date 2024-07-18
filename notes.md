# SDK Notes 

See the [DESIGN.md](./DESIGN.md) for overall design considerations.

This document details some things that could be improved about the SDK.

## General

The [token registry](./tokenRegistry/) directory is unused except for importing the tokens from connect, which is no longer necessary.

It is still possible to screw up a transfer (blackhole funds) if the higher level constructs (`WormholeTransfer` or `Route`) are not used and care is not taken to produce a transfer that is acceptable by the destination chain. I have no suggestions for this that would prevent the platform-specific-oddities from leaking into packages they have no business in besides "better documentation" or disallow it completely.

Examples: 

- Invalid ATA receiver for Solana destined transfer. An [issue](https://github.com/wormhole-foundation/wormhole/issues/3992) has been filed to reduce the danger for this one.

    - https://wormholescan.io/#/tx/0x1605bd06e15d46398c061bd2fc24e65c2b580d07c3e7a4ca9a0643bf91d16a7c
    - https://wormholescan.io/#/tx/DnEXtm2NdLhT5RszHc7nR7LPNATzGSP3kmbC2GQkAJyK


- Incorrect contract address in payload, caused by a bug that allowed an empty address to be passed for the remote contract.

    - https://wormholescan.io/#/tx/2g4nn6fWZCkphxeMGfqjzViZYo3XAYarYTSvTcxYY95JAtZvwVd7MKY6RWHhhHd8oBzeFWjuTkXNo4tdVVTwBWfo


Docs and test coverage is lacking.

## Core

### Base

The [tokens](./core/base/src/constants/tokens) consts take up a lot of packed space in a widely used package for marginal benefit. Consider making these a wholly separate package that _can_ be installed and fetched when necessary. 

The [nativeChainIds](./core/base/src/constants/nativeChainIds.ts) constants mix different chain id types, causing extra akward type checks to be done. Consider splitting these by platform so that when a `Chain` is passed, the type of chain id can be inferred. Also will help to distinguish between chain id _kinds_ (eip155 vs whatever) since they could be unique at least in that context.

The [Network](./core/base/src/constants/networks.ts) value "Devnet" is confusing to folks coming from Solana since it refers to some ci or local network configuration profile and what they actually want is "Testnet". 

The network breakdown might serve better as a named configuration profile instead, where the dev would not have to, for example, map the name "Ethereum" to (Mainnet->Ethereum, Testnet->Sepolia), rather, that would be part of the configuration profile definition. Possibly defined as overrides from the defaults of "Mainnet"|"Testnet"|"Devnet".

This would constitute a large change since the Network type is a generic parameter for many other types.

The [layouts](./core/base/src/utils/layout/index.ts) could be broken out into their own package for more generic uses outside the context of the wormhole sdk.

### Definitions


The [layout definitions](./core/definitions/src/protocols/tokenBridge/tokenBridgeLayout.ts) for the protocols are very difficult to read/comprehend from just source. We could have some way to write out the full object produced so that the fields it contains are easier to read.

The [Attestation/AttestationId](./core/definitions/src/attestation.ts) could be registered along with the protocol instead of having a hardcoded switch case.  The current definition makes it very awkward to use for anything outside this repo, but since its used in the Routes, external "plugins" need to have _something_. This forces the Attestation type to be a punted `VAA<"Uint8Array">`

The [RPC](./core/definitions/src/rpc.ts) is a punted `any` type. It could benefit from the same type registration as others, where the exact type is set in some namespace so that type inteference would be happy with something like: 

```ts
(await ChainContext<"Mainnet", "Solana">.getRpc()) satisfies Connection
```

The [protocols](./core/definitions/src/protocols/) could have **standard** fields in their respective `namespace` for things like:

- Which contracts are required (eg `Required<Contracts, 'tokenBridge' | 'coreBridge'>`)
- The protocol name/payload names ([issue here](https://github.com/wormhole-foundation/wormhole-sdk-ts/issues/564))
- The emitter address for the protocol 
- A disciminator/serde for its VAAs/payloads 
- Standardized Errors that may be thrown 

Note: it is possible to enforce a namespace adheres to an interface
```ts
interface x { doit(): void; }
interface z { dont(): void; }
namespace y { export function doit () { return; } }
// ok
y satisfies x;
// not ok, will not compile
// y satisfies z;
```



## Connect

The [Wormhole](./connect/src/wormhole.ts) class has spotty coverage of util methods. Some of the methods are awkward to have on `Wormhole` like `canonicalAddress` which is already an exported method.  

Getting decent typehints for the [Route](./connect/src/routes/route.ts) implementations has been rough. We could, in the route, provide a typeguard that can be called to narrow the type to itself. This would be helpful to understand the exact types required as input (specific options per route, etc) and what is returned on output (more detailed route specific quote details, etc).

The [Receipt typeguards](./connect/src/types.ts) could also define `hasSourceInitiated`, `hasAttested`, etc for checking if the transfer is _past_ some step.

The [Wormholescan API](./connect/src/whscan-api.ts) could be better documented and possibly autogenerated from the swagger for the api. 

The classes that implement the [WormholeTransfer](./connect/src/protocols/wormholeTransfer.ts) could be deprecated in favor of the `Route` usage. The underlying code could be preserved and made available in a static context where all args are provided rather than keeping state in the `WormholeTransfer` object.

## Platforms

Every Protocol implementation defines its own private `createUnsignedTransaction` function, which, kinda sucks. 

The Signer implementations are bad at things like gas estimation or handling errors. They could also provide support for transaction review prior to signing.


### Evm

The [addFrom/addValue/addChainId](./platforms/evm/src/types.ts) util functions could be made into a single "populate default fields" kind of function that sets the required fields.

Consider removing [Portico](./platforms/evm/protocols/portico/) completely from this repository and provide a new package similar to mayan or ntt outside of this repository.

### Solana

A lot of the code here was copy/pasted without regard to what was actually necessary. Consider purging any unused functions.

While the `Buffer` type has been kept out of most packages intentionally, the Solana packages have not been as strict. For web applications this can still be a pain, consider trying to purge it completely.

The [Unsigned Transaction](./platforms/solana/src/unsignedTransaction.ts) type can handle versioned transactions but we still only produce the legacy transaction type. We could produce the versioned transactions since they'll provide more features in the future, [issue here](https://github.com/wormhole-foundation/wormhole-sdk-ts/issues/163).

### Cosmwasm

There are some awkward [consts](./platforms/cosmwasm/src/constants.ts) for address prefix and average prices (??) 

The IBC channel consts need to be updated with the [fetch-registry](./platforms/cosmwasm/scripts/fetch-registry.ts) script occasionally.

The IBC protocol could probably have just been `Gateway` instead, that is a new Protocol for `Gateway` specific methods could have been created instead of exposing ibc methods. The connect package `GatewayTransfer` is made awkard by the current setup.

### Sui

Disaster show wrt types, a lot of weird type checking to get some deeply nested field in a MoveValue.
