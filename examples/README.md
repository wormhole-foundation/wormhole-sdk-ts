# Connect SDK Examples


## Usage

1) git clone this repo and rebuild then cd to this directory

```sh
git clone  https://github.com/wormhole-foundation/connect-sdk.git
npm install
npm run build
cd examples
```

2) Optionally modify token bridge or cctp programs

3) run stuff

```sh
npm run tb
# or
npm run cctp
# or
npm run gateway
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