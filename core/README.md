SDK Core
--------

The SDK Core is broken into several logical subpackages 

## Base

The `base` package contains constants (e.g. contract addresses, RPC config, Finality, etc...) 


## Definitions

The `definitions` package contains definitions for the VAA structures and interfaces for interacting with supported protocols (e.g. TokenBridge)


## Connect 

The `connect` package contains the classes and types are used directly by developers.

It should provide the interface that can dispatch calls to the correct Context objects for a given platform/network/chain 

