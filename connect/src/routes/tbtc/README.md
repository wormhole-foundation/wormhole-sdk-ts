The TBTCRoute enables the transfer of both native and Wormhole-wrapped Ethereum TBTC across Solana and EVM chains.

Arbitrum, Base, Optimism, Polygon, and Solana have a gateway contract. This contract mints native TBTC when it receives a payload3 transfer of Wormhole-wrapped TBTC from the token bridge. Conversely, it burns native TBTC when bridging out. Wormhole-wrapped TBTC serves as the "highway" asset for bridging TBTC between chains.
Transfers of TBTC to chains without a gateway contract are regular token bridge transfers.

You can view the EVM L2WormholeGateway contract code [here](https://github.com/keep-network/tbtc-v2/blob/main/solidity/contracts/l2/L2WormholeGateway.sol). The Solana contract is [here](https://github.com/keep-network/tbtc-v2/tree/main/cross-chain/solana).
