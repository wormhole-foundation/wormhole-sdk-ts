Design Document for Wormhole SDK
---------------------------------

# Organization

Code is organized into workspaces so that each can be its own module.

```
core/
    base/ -- Constants
    definitions/ -- VAA structures and module definitions
    connect/ -- Primary package and interface through Wormhole 

platforms/ -- Platform specific logic 
    evm/
    solana/
    ...
```

# Concepts

The `Wormhole` class provides methods to interact with the Wormhole protocol by mapping chain parameters to the `Platform` and `Chain` specific implementations.

A `Platform` is a blockchain runtime, often shared across a number of chains (e.g. `Evm` platform for `Ethereum`, `Bsc`, `Polygon`, etc ...). 

A `Chain` is a specific blockchain, potentially with overrides for slight differences in the platform implementation. 

A `Module` is a specific application on a `Chain`, it provides a set of methods that can be called to accomplish some action (e.g. `TokenBridge` allows send,receive,lookup token, etc...)

A `Signer` is an interface that provides a callback to sign one or more transaction objects. These signed transactions are sent to the blockchain to invoke some action.


# Responsibilities

## Wormhole 

Registers Platforms
Allows overriding chain specific configs (rpc, contract addresses, ...)

Provides methods to get PlatformContext or ChainContext objects
```ts
wh.getPlatform("Evm")
wh.getChain("Ethereum")
```
Provides methods to create a `WormholeTransfer` for any `Module`

```ts
wh.tokenTransfer(...)
wh.nftTransfer(...)
wh.cctp(...)
//...
```

Provides methods to query API for VAAs and token details
```ts
// grab a vaa with identifier
wh.getVaa(...)
// get the token details 
wh.getOriginalToken(...)
wh.getWrappedToken(orig, chain)
```

## PlatformContext

Base class to implement Platform specific logic?

e.g.
Evm requires approve token spend then transfer
Solana requires postVaa then call redeem


## ChainContext

Inherits from PlatformContext?

Holds RPC connection, initialized from default or overrides

```ts
cc.getRPC() // for evm -> ethers.Provider, for sol -> web3.Connection
```

Holds references to Contract client 

Provides methods to lookup details for contract addresses, finality, address parsers/formatters

```ts
cc.getTokenBridgeAddress()
cc.estimateFinality(txid)
```

Provides methods to dump transactions to invoke some action

```ts

```

## WormholeTransfer

Holds a reference to ChainContexts
Holds details about the transfer
May hold a ref to Signer
Provides methods to step through the transfer process

Escape hatch to just dump transactions?

## Glossary

- Network
    Mainnet, Testnet, Devnet
- Platform
    A chain or group of chains within the same ecosystem that share common logic (e.g. EVM, Cosmwasm, etc)
- Platform Context
    A class which implements a standardized format and set of methods. It may include additional chain-specific methods and logic.
- Module
    A cross-chain application built on top of Wormhole (the core contracts are also considered a module)
- Universal Address
    A 32-byte address, used by the wormhole contracts
- Native Address (I think this should be called "Platform Address")
    An address in the standard chain-specific format
- Native
    The "home" chain (e.g. ETH is native to Ethereum)
- Foreign
    A non-native chain (e.g. ETH is foreign to Moonbeam)
- VAA (Verified Action Approval)
    The core messaging primitive in Wormhole, it contains information about a message and a payload encoded as bytes.  Once finality is achieved and it is observed by the majority of the guardians, it is signed and can then be used to complete a transfer on the destination chain
- Payload
    Bytes that can be passed along with any wormhole message that contain application-specific data
- Finality/Finality Threshold
    The required number of blocks to wait until a VAA is produced

# Discussion


## What's the purpose of the Wormhole class?

Wormhole class provides the main interface to do _everything_

- Registers Platforms to access later -- constructor
- Provides access to PlatformContexts -- getContext(ChainName)
- Provides "shortcuts" to start a WormholeTransfer -- tokenTransfer/nftTransfer/cctp/...
- Helpers for getting VAAs? or generally querying the API?
- Abstract away chain-specific logic for easy mode access to methods

## What do we want from a PlatformContext and how is that different from a provider / common utilities for a given platform?

Provides Platform specific logic for a set of things

- Register Modules (contract/app specific functionality)
- Translates Platform specific stuff to generic stuff (e.g. ethers.Provider => RPC connection)
- Deals with Platform specific interaction w/ chain (approve on eth, postvaa on sol, ...)
- Implements standardized method format

## What's the relationship between platforms/chains/providers?

- A Platform provides the logic for all chains that run on that platform
- A Chain provides consts (rpc/contract addresses/chain specific overrides)
- A Provider is just an RPC connection and is held by the Chain. Providers are an implementation detail.

## What's a signer vs. a wallet? Should signers have a provider (my answer: no)?

- A Signer is an interface to sign transactions
- It _may_ be backed by a wallet but not necessarily, as long as it fulfils the interface

## Can we provide some way to make other non-standard applications available to use through the WormholeTransfer?

Say I have an app that defines its own protocol, can I provide something that adheres to the WormholeTransfer interface so a dev can install it and call it like the TokenTransfer?

## What is the preferred terminology to refer to either end of a cross-chain message: from/to, source/target or origin/destination?

## What is the preferred terminology for the core Wormhole layer? (i.e. Core Contracts or Wormhole Contracts)

## It seems like we've moved away from supporting ChainName AND Chain ID in methods. Is it preferred to only use ChainName and what is the reasoning there?  I think it's convenient to support either.
