

Get the contracts and build them
```
git clone https://github.com/wormhole-foundation/example-native-token-transfers
cd example-native-token-transfers
make build-evm
```

Then, in this dir

```
npx typechain --target ethers-v6 --out-dir src/ethers-contracts/ ~/example-native-token-transfers/evm/out/NttManager.sol/NttManager.json
npx typechain --target ethers-v6 --out-dir src/ethers-contracts/ ~/example-native-token-transfers/evm/out/WormholeTransceiver.sol/WormholeTransceiver.json
```


