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


const sender: Signer =  // ...
const receiver: Signer = // ...

// Get the ChainAddress for the sender and receiver signers
const senderAddress: ChainAddress = nativeChainAddress(sender)     
const receiverAddress: ChainAddress = nativeChainAddress(receiver) 

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

This package is a Work in Progress so the interface may change. 


## TODOS:


Chains: 

- [ ] Add support for Aptos chains
- [ ] Add support for Sei chains
- [ ] Add support for Sui chains
- [ ] Add support for Cosmos chains
- [ ] Add support for Algorand chains
- [ ] Add support for Terra chains
- [ ] Add support for Near chains

Other:

- [ ] Reexport common types from connect?
- [ ] Add support for NFTBridge protocols
- [ ] Gas utilities (estimate from unsigned, get gas used from txid) 
- [ ] Better tracking of auto-redeem, use target contract?
- [ ] Estimate tx finalization
- [ ] Event emission/subscription for status changes 
- [ ] Validation of inputs (amount > dust, etc..)
