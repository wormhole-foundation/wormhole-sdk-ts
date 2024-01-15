# Connect SDK Examples


## Usage

1) Clone this repo, install and build, then cd to this directory

```sh
git clone  https://github.com/wormhole-foundation/connect-sdk.git
npm install
npm run build
cd examples
```

2) Add (development) private keys to the `.env` file to sign transactions 

> Note: see `getStuff` function in the [helpers](./src/helpers/helpers.ts) for the appropriate env vars to use.

3) Run an example program 

```sh
npm run tb
# or
npm run cctp
# or
npm run gateway
# or
npm run msg
```

## Token Bridge

Demonstrates sending  of th

[Source File](src/tokenBridge.ts)

## CCTP

Demonstrates sending USDC using either CCTP or CCTP+Wormhole Auto Relayers

[Source File](src/cctp.ts)


## Gateway (Cosmos)

Demonstrates sending into, around, and out of Cosmos through the GAteway

[Source File](src/cosmos.ts)

## Messaging

Demonstrates invoking the core bridge with a custom message then validating the signed VAA on the same chain.

This example is essentially useless but illustrative of the flow.

[Source File](src/messaging.ts)