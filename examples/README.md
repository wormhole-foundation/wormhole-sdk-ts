# Connect SDK Examples


## TODOS:


- [ ] Arbitrum rpc?
- [ ] Test !native Assets in token bridge 
- [ ] Better tracking of auto-redeem, use target contract?
- [ ] gas dropoff
- [ ] tx finalization estimate
- [ ] event emission/subscription for status changes 
- [ ] add gateway protocol 
- [ ] Validation of inputs (amount > dust, etc..)
- [ ] re-export common types from connect?
- [ ] gas estimation of routes?

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
```

## Token Bridge

Demonstrates sending  of th

[Source File](src/tokenBridge.ts)

## CCTP

Demonstrates sending USDC using either CCTP or CCTP+Wormhole Auto Relayers

[Source File](src/cctp.ts)

## NFT Bridge

## Gateway (Cosmos)