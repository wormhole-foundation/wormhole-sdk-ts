# Connect SDK

The primary component here is the Wormhole class, which serves as a wrapper for all the sdk methods.  It ensures that each chain implements certain methods with the same function signature and provides an interface for calling those methods easily.

## Usage

A developer would use the core connect-sdk package in conjunction with 1 or more of the chain context packages. Most developers don't use every single chain and may only use a couple, this allows developers to import only the dependencies they actually need.

Getting started is simple, just import and pass in the contexts to the Wormhole class.

```ts

import { Wormhole, Signer } from '@wormhole-foundation/connect-sdk';
import { EvmContext } from '@wormhole-foundation/connect-sdk-evm';
import { SolanaContext } from '@wormhole-foundation/connect-sdk-solana';

const network = "Mainnet";
const wh = new Wormhole(network, [EvmContext, SolanaContext]);


```

In order to sign transactions, a `Signer` interface is required.  This is a simple interface that can be implemented by wrapping a wallet or other signing mechanism.  The `Signer` interface is defined as follows: 

```ts
interface Signer {
  // Wormhole defined chain name
  chain(): ChainName;
  // canonical string address format for chain
  address(): string;
  // sign a message, performing any additional checks or validation
  sign(tx: UnsignedTransaction[]): Promise<SignedTx[]>;
}


const sender: Signer =  // ...
const receiver: Signer = // ...

// Get the ChainAddress for the sender and receiver signers
const senderAddress: ChainAddress = nativeChainAddress(sender)     
const receiverAddress: ChainAddress = nativeChainAddress(receiver) 

```
See the [example signers](./examples/src/helpers/signers.ts) for examples of how to implement a signer for a specific chain.


With the signer(s) available, we can create a new `WormholeTransfer` object (`TokenTransfer`, `CCTPTransfer`, `GatewayTransfer`, ...) and use it to transfer tokens between chains.  The `WormholeTransfer` object is responsible for tracking the transfer through the process and providing updates on its status. 

```ts
// Create a TokenTransfer object, allowing us to shepard the transfer through the process and get updates on its status
const manualXfer = wh.tokenTransfer(
  'native',         // send native gas on source chain
  10n,              // amount in base units
  senderAddress,    // Sender address on source chain
  recipientAddress, // Recipient address on destination chain
  false,            // No Automatic transfer
)

// 1) Submit the transactions to the source chain, passing a signer to sign any txns
const srcTxids = await manualXfer.initiateTransfer(src.signer);

// 2) wait for the VAA to be signed and ready (not required for auto transfer)
const attestIds = await manualXfer.fetchAttestation();

// 3) redeem the VAA on the dest chain
const destTxids = await manualXfer.completeTransfer(dst.signer);

```

Some transfers allow for automatic relaying to the destination, in that case only the `initiateTransfer` is required. The status of the transfer can be tracked by periodically checking the status of the transfer object (TODO: event emission).

```ts

// OR for an automatic transfer
const automaticXfer = wh.tokenTransfer(
  'native',         // send native gas on source chain
  10n,              // amount in base units
  senderAddress,    // Sender address on source chain
  recipientAddress, // Recipient address on destination chain
  true,             // Automatic transfer
)

// 1) Submit the transactions to the source chain, passing a signer to sign any txns
const srcTxids = await automaticXfer.initiateTransfer(src.signer);
// 2) If automatic, we're done, just wait for the transfer to complete
if (automatic) return waitLog(automaticXfer) ;

```


## WIP

:warning: This package is a Work in Progress so the interface may change and there are likely bugs.  Please report any issues you find.


## TODOS:

Chains: 

- [ ] Add support for Aptos chains
- [ ] Add support for Algorand chains
- [ ] Add support for Sui chains
- [ ] Add support for Near chains

Other:

- [ ] Add support for NFTBridge protocols
- [ ] Simulate prior to sending 
- [ ] Gas utilities (estimate from unsigned, get gas used from txid) 
- [ ] Better tracking of auto-redeem, use target contract?
- [ ] Estimate tx finalization
- [ ] Event emission/subscription for status changes 
- [ ] Validation of inputs (amount > dust, etc..)
