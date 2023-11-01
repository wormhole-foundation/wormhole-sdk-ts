SDK Core
--------

The SDK Core is broken into several logical subpackages 

## Base

The `base` package contains:
- constants (e.g. contract addresses, RPC config, Finality, etc...) 
- utility types to for accessing and validating constants 

## Definitions

The `definitions` package contains:

- definitions for the VAA payload structure layout
- definitions of interfaces for Platforms and ChainContexts
- definitions of protocol interfaces  (e.g. TokenBridge, Circle, etc...)
- definitions of types (e.g. Address, TokenId, Signer, etc...)
