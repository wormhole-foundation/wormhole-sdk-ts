# Design

## Structure

A primary goal for the SDK is to provide modular and specific access to the protocols build on Wormhole. 

To address this goal, the SDK is structured into layers
```
core/ -- Low level packages 
    base/ -- Constants and utilities
    definitions/ -- Definitions of interfaces for Platforms/Protocols and Payload Layouts
    icons/ -- Logos for chains

connect/ -- Makes use of the interfaces in `definitions` to expose protocols in a platform independent way. 

platforms/ -- Contains `Platform` and `Protocol` implementations
    evm/ 
        protocols/ -- Contains the Evm `Protocol` implementations
            core/  -- `EvmWormholeCore` implementation
            tokenBridge/ -- `EvmTokenBridge` implementation
            cctp/ `EvmCircleBridge` implementation
            ...
        src/ -- Contains the Evm implementations for `Platform`, `Chain`, `Address`, etc...
    solana/ -- Contains Solana `Platform` and `Protocol` implementations
    etc...

sdk/ -- Metapackage that depeneds on the rest of the packages, meant to be a simpler way to install/use.

examples/ -- Examples, also used for README string replace
```

# Interfaces

Interfaces defined in `core/definitions` are implemented for each platform on which they are supported. 

## Platform Interfaces 

Several interfaces should be available for each platform supported.

- A `Platform` is a blockchain runtime, often shared across a number of chains (e.g. `Evm` platform for `Ethereum`, `Bsc`, `Polygon`, etc ...). 

- A `Chain` is a specific blockchain, potentially with overrides for slight differences in the platform implementation. 

- An `Address` provides parsing/formatting/conversion for platform specific addresses. 

- A `Signer` is an interface that provides a callback to `sign` or `signAndSend` one or more transaction objects. 

    > The Signer interface is intended to be flexible enough to allow devs to provide their own implementation with more specific transaction creation/configuration/submission logic than what could be covered in the default provided signers. It also allows for the creation of Signers that wrap hardware wallets or web wallets.

## Protocol Interfaces

A Protocol (fka `Module`) is a specific application, it provides a set of methods that can be called to accomplish some action (e.g. `TokenBridge` allows `transfer`/`redeem`/`getWrappedAsset`, etc...)

To allow platform agnostic access to Protocols, each Platform that provides the protocol should have its own implementation. 

# Platform packages

Each platform has implementations of the relevant interfaces from `core/definitions` as well as implementations for each protocol supported on that platform.

The platform package should be the only one that depends on packages for that platform (eg ethersv6 for evm).

# Connect package

The `connect` package provides access to all the `Platform` and `Protocol` implementations through their interfaces. 

The `Wormhole` class represents a context to register specific Platforms and set some initial configuration overrides. It provides utility methods to do things like create a `ChainContext` or parse an address.

The `routes` directory contains the logic to make use of the Protocol implementations by composing a route through the use of one or more Protocol interfaces.

# SDK package

The `@wormhole-foundation/sdk` package was created to reduce the confusion reported by devs around what they needed to install and use. 

Because this project has strict separation of platform implementation packages, the registration of platforms and protocols is done as a side effect. As a result, naked imports may be required for lower level packages to be properly registered. 

This package specifies _all_ platforms and protocols as dependencies which increases installed size but provides provides conditional exports for each `Platform` to allow for a smaller bundle size.

Each platform has a `PlatformDefiniton` containing the `Platform` specific implementations that can be imported directly or through the `PlatformLoader` which ensures the protocols are registered as well.