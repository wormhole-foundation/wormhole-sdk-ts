# Wormhole TS SDK

The Wormhole Typescript SDK is useful for interacting with the chains Wormhole supports and the [protocols](#protocols) built on top of Wormhole.

## Warning 

:warning: This package is a Work in Progress so the interface may change and there are likely bugs. Please [report](https://github.com/wormhole-foundation/connect-sdk/issues) any issues you find. :warning:

## Installation

### Basic 

Install the (meta) package

```bash
npm install @wormhole-foundation/sdk
```

This package combines all the individual packages in a way that makes setup easier while still allowing for tree shaking. 

### Advanced

Alternatively, for an advanced user, install a specific set of the packages published.

```bash
# constants
npm install @wormhole-foundation/sdk-base
# contract interfaces, basic types, vaa payload definitions
npm install @wormhole-foundation/sdk-definitions
# Evm specific utilities
npm install @wormhole-foundation/sdk-evm
# Evm TokenBridge protocol client
npm install @wormhole-foundation/sdk-evm-tokenbridge
```

## Usage

Getting started is simple, just import Wormhole and the [Platform](#platforms) modules you wish to support

<!--EXAMPLE_IMPORTS-->
```ts
import { wormhole } from "@wormhole-foundation/sdk";
import algorand from "@wormhole-foundation/sdk/algorand";
import cosmwasm from "@wormhole-foundation/sdk/cosmwasm";
import evm from "@wormhole-foundation/sdk/evm";
import solana from "@wormhole-foundation/sdk/solana";
import sui from "@wormhole-foundation/sdk/sui";
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/index.ts#L2)
<!--EXAMPLE_IMPORTS-->

And pass those to the Wormhole constructor to make them available for use

<!--EXAMPLE_WORMHOLE_INIT-->
```ts
  const wh = await wormhole("Testnet", [evm, solana, algorand, sui, cosmwasm]);
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/index.ts#L15)
<!--EXAMPLE_WORMHOLE_INIT-->

With a configured Wormhole object, we have the ability to do things like; parse addresses for the platforms we passed, get a [ChainContext](#chain-context) object, or fetch VAAs.

<!--EXAMPLE_WORMHOLE_CHAIN-->
```ts
  // Grab a ChainContext object from our configured Wormhole instance
  const ctx = wh.getChain("Solana");
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/index.ts#L19)
<!--EXAMPLE_WORMHOLE_CHAIN-->

<!--EXAMPLE_WORMHOLE_VAA-->
```ts
  // Get the VAA from the wormhole message id
  const vaa = await wh.getVaa(
    // Wormhole Message ID
    whm!,
    // Protocol:Payload name to use for decoding the VAA payload
    "TokenBridge:Transfer",
    // Timeout in milliseconds, depending on the chain and network, the VAA may take some time to be available
    60_000,
  );
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/index.ts#L48)
<!--EXAMPLE_WORMHOLE_VAA-->


Optionally, the default configuration may be overriden in the case that you want to support, eg a different RPC endpoint.

<!--EXAMPLE_CONFIG_OVERRIDE-->
```ts
  // Pass a partial WormholeConfig object to override specific
  // fields in the default config
  const wh = await wormhole("Testnet", [solana], {
    chains: {
      Solana: {
        contracts: {
          coreBridge: "11111111111111111111111111111",
        },
        rpc: "https://api.devnet.solana.com",
      },
    },
  });
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/config.ts#L6)
<!--EXAMPLE_CONFIG_OVERRIDE-->

## Concepts

Understanding several higher level concepts of the SDK will help in using it effectively.

### Platforms

Every chain is its own special snowflake but many of them share similar functionality. The `Platform` modules provide a consistent interface for interacting with the chains that share a platform.

Each platform can be installed separately so that dependencies can stay as slim as possible.

### Chain Context

The `Wormhole` class provides a `getChain` method that returns a `ChainContext` object for a given chain. This object provides access to the chain specific methods and utilities. Much of the functionality in the `ChainContext` is provided by the `Platform` methods but the specific chain may have overridden methods.

The ChainContext object is also responsible for holding a cached rpc client and protocol clients.

```ts
// Get the chain context for the source and destination chains
// This is useful to grab direct clients for the protocols
const srcChain = wh.getChain(senderAddress.chain);
const dstChain = wh.getChain(receiverAddress.chain);

const tb = await srcChain.getTokenBridge(); // => TokenBridge<'Evm'>
srcChain.getRpcClient(); // => RpcClient<'Evm'>
```


### Addresses

Within the Wormhole context, addresses are often [normalized](https://docs.wormhole.com/wormhole/blockchain-environments/evm#addresses) to 32 bytes and referred to in this SDK as a `UniversalAddresses`.

Each platform comes with an address type that understands the native address formats, unsurprisingly referred to as NativeAddress. This abstraction allows the SDK to work with addresses in a consistent way regardless of the underlying chain.

```ts
// Its possible to convert a string address to its Native address
const ethAddr: NativeAddress<"Evm"> = toNative("Ethereum", "0xbeef...");

// A common type in the SDK is the `ChainAddress` which provides
// the additional context of the `Chain` this address is relevant for.
const senderAddress: ChainAddress = Wormhole.chainAddress("Ethereum","0xbeef...");
const receiverAddress: ChainAddress = Wormhole.chainAddress("Solana","Sol1111...");

// Convert the ChainAddress back to its canonical string address format
const strAddress = Wormhole.canonicalAddress(senderAddress); // => '0xbeef...'

// Or if the ethAddr above is for an emitter and you need the UniversalAddress
const emitterAddr = ethAddr.toUniversalAddress().toString()
```

### Tokens 

Similar to the `ChainAddress` type, the `TokenId` type provides the Chain and Address of a given Token.

```ts
// Returns a TokenId 
const sourceToken: TokenId = Wormhole.tokenId("Ethereum","0xbeef...");

// Whereas the ChainAddress is limited to valid addresses, a TokenId may
// have the string literal 'native' to consistently denote the native
// gas token of the chain
const gasToken: TokenId = Wormhole.tokenId("Ethereum","native");

// the same method can be used to convert the TokenId back to its canonical string address format
const strAddress = Wormhole.canonicalAddress(senderAddress); // => '0xbeef...'
```


### Signers

In order to sign transactions, an object that fulfils the `Signer` interface is required. This is a simple interface that can be implemented by wrapping a web wallet or other signing mechanism.

```ts
// A Signer is an interface that must be provided to certain methods
// in the SDK to sign transactions. It can be either a SignOnlySigner
// or a SignAndSendSigner depending on circumstances.
// A Signer can be implemented by wrapping an existing offline wallet
// or a web wallet
export type Signer = SignOnlySigner | SignAndSendSigner;

// A SignOnlySender is for situations where the signer is not
// connected to the network or does not wish to broadcast the
// transactions themselves
export interface SignOnlySigner {
  chain(): ChainName;
  address(): string;
  // Accept an array of unsigned transactions and return
  // an array of signed and serialized transactions.
  // The transactions may be inspected or altered before
  // signing.
  // Note: The serialization is chain specific, if in doubt,
  // see the example implementations linked below
  sign(tx: UnsignedTransaction[]): Promise<SignedTx[]>;
}

// A SignAndSendSigner is for situations where the signer is
// connected to the network and wishes to broadcast the
// transactions themselves
export interface SignAndSendSigner {
  chain(): ChainName;
  address(): string;
  // Accept an array of unsigned transactions and return
  // an array of transaction ids in the same order as the
  // UnsignedTransactions array.
  signAndSend(tx: UnsignedTransaction[]): Promise<TxHash[]>;
}
```

See the testing signers ([Evm](https://github.com/wormhole-foundation/connect-sdk/blob/main/platforms/evm/src/signer.ts), [Solana](https://github.com/wormhole-foundation/connect-sdk/blob/main/platforms/solana/src/signer.ts), ...) for an example of how to implement a signer for a specific chain or platform.

### Protocols

While Wormhole itself is a Generic Message Passing protocol, a number of protocols have been built on top of it to provide specific functionality.

Each Protocol, if available, will have a Platform specific implementation. These implementations provide methods to generate transactions or read state from the contract on-chain.

#### Wormhole Core

The protocol that underlies all Wormhole activity is the Core protocol. This protocol is responsible for emitting the message containing the information necessary to perform bridging including [Emitter address](https://docs.wormhole.com/wormhole/reference/glossary#emitter), the [Sequence number](https://docs.wormhole.com/wormhole/reference/glossary#sequence) for the message and the Payload of the message itself.

<!--EXAMPLE_CORE_BRIDGE-->
```ts
  const wh = await wormhole("Testnet", [solana]);

  const chain = wh.getChain("Solana");
  const { signer, address } = await getSigner(chain);

  // Get a reference to the core messaging bridge
  const coreBridge = await chain.getWormholeCore();

  // Generate transactions, sign and send them
  const publishTxs = coreBridge.publishMessage(
    // Address of sender (emitter in VAA)
    address.address,
    // Message to send (payload in VAA)
    encoding.bytes.encode("lol"),
    // Nonce (user defined, no requirement for a specific value, useful to provide a unique identifier for the message)
    0,
    // ConsistencyLevel (ie finality of the message, see wormhole docs for more)
    0,
  );
  // Send the transaction(s) to publish the message
  const txids = await signSendWait(chain, publishTxs, signer);

  // Take the last txid in case multiple were sent
  // the last one should be the one containing the relevant
  // event or log info
  const txid = txids[txids.length - 1];

  // Grab the wormhole message id from the transaction logs or storage
  const [whm] = await chain.parseTransaction(txid!.txid);

  // Or pull the full message content as an Unsigned VAA
  // const msgs = await coreBridge.parseMessages(txid!.txid);
  // console.log(msgs);

  // Wait for the vaa to be signed and available with a timeout
  const vaa = await wh.getVaa(whm!, "Uint8Array", 60_000);
  console.log(vaa);
  // Also possible to search by txid but it takes longer to show up
  // console.log(await wh.getVaaByTxHash(txid!.txid, "Uint8Array"));

  const verifyTxs = coreBridge.verifyMessage(address.address, vaa!);
  console.log(await signSendWait(chain, verifyTxs, signer));
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/messaging.ts#L7)
<!--EXAMPLE_CORE_BRIDGE-->

Within the payload is the information necessary to perform whatever action is required based on the Protocol that uses it.

#### Token Bridge

The most familiar protocol built on Wormhole is the Token Bridge.

Every chain has a `TokenBridge` protocol client that provides a consistent interface for interacting with the Token Bridge. This includes methods to generate the transactions required to transfer tokens, as well as methods to generate and redeem attestations.

Using the `WormholeTransfer` abstractions is the recommended way to interact with these protocols but it is possible to use them directly

```ts
import { signSendWait } from "@wormhole-foundation/sdk";

// ...

const tb = await srcChain.getTokenBridge(); // => TokenBridge<'Evm'>

const token = "0xdeadbeef...";
const txGenerator = tb.createAttestation(token); // => AsyncGenerator<UnsignedTransaction, ...>
const txids = await signSendWait(srcChain, txGenerator, src.signer); // => TxHash[]
```

Supported protocols are defined in the [definitions module](https://github.com/wormhole-foundation/connect-sdk/tree/main/core/definitions/src/protocols).


## Transfers

While using the [ChainContext](#chain-context) and [Protocol](#protocols) clients directly is possible, to do things like transfer tokens, the SDK provides some helpful abstractions.

The `WormholeTransfer` interface provides a convenient abstraction to encapsulate the steps involved in a cross-chain transfer.

### Token Transfers

Performing a Token Transfer is trivial for any source and destination chains.

We can create a new `Wormhole` object and use it to to create `TokenTransfer`, `CircleTransfer`, `GatewayTransfer`, etc. objects to transfer tokens between chains. The transfer object is responsible for tracking the transfer through the process and providing updates on its status.

<!--EXAMPLE_TOKEN_TRANSFER-->
```ts
  // Create a TokenTransfer object to track the state of the transfer over time
  const xfer = await wh.tokenTransfer(
    route.token,
    route.amount,
    route.source.address,
    route.destination.address,
    route.delivery?.automatic ?? false,
    route.payload,
    route.delivery?.nativeGas,
  );

  const quote = await TokenTransfer.quoteTransfer(
    wh,
    route.source.chain,
    route.destination.chain,
    xfer.transfer,
  );
  console.log(quote);

  if (xfer.transfer.automatic && quote.destinationToken.amount < 0)
    throw "The amount requested is too low to cover the fee and any native gas requested.";

  // 1) Submit the transactions to the source chain, passing a signer to sign any txns
  console.log("Starting transfer");
  const srcTxids = await xfer.initiateTransfer(route.source.signer);
  console.log(`Started transfer: `, srcTxids);

  // If automatic, we're done
  if (route.delivery?.automatic) return xfer;

  // 2) Wait for the VAA to be signed and ready (not required for auto transfer)
  console.log("Getting Attestation");
  const attestIds = await xfer.fetchAttestation(60_000);
  console.log(`Got Attestation: `, attestIds);

  // 3) Redeem the VAA on the dest chain
  console.log("Completing Transfer");
  const destTxids = await xfer.completeTransfer(route.destination.signer);
  console.log(`Completed Transfer: `, destTxids);
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/tokenBridge.ts#L125)
<!--EXAMPLE_TOKEN_TRANSFER-->


Internally, this uses the [TokenBridge](#token-bridge) protocol client to transfer tokens. The `TokenBridge` protocol, like other Protocols, provides a consistent set of methods across all chains to generate a set of transactions for that specific chain.

### Native USDC Transfers

We can also transfer native USDC using [Circle's CCTP](https://www.circle.com/en/cross-chain-transfer-protocol)

<!--EXAMPLE_CCTP_TRANSFER-->
```ts
  const xfer = await wh.circleTransfer(
    // amount as bigint (base units)
    req.amount,
    // sender chain/address
    src.address,
    // receiver chain/address
    dst.address,
    // automatic delivery boolean
    req.automatic,
    // payload to be sent with the transfer
    undefined,
    // If automatic, native gas can be requested to be sent to the receiver
    req.nativeGas,
  );

  // Note, if the transfer is requested to be Automatic, a fee for performing the relay
  // will be present in the quote. The fee comes out of the amount requested to be sent.
  // If the user wants to receive 1.0 on the destination, the amount to send should be 1.0 + fee.
  // The same applies for native gas dropoff
  const quote = await CircleTransfer.quoteTransfer(src.chain, dst.chain, xfer.transfer);
  console.log("Quote", quote);

  console.log("Starting Transfer");
  const srcTxids = await xfer.initiateTransfer(src.signer);
  console.log(`Started Transfer: `, srcTxids);

  // Note: Depending on chain finality, this timeout may need to be increased.
  // See https://developers.circle.com/stablecoin/docs/cctp-technical-reference#mainnet for more
  console.log("Waiting for Attestation");
  const attestIds = await xfer.fetchAttestation(60_000);
  console.log(`Got Attestation: `, attestIds);

  console.log("Completing Transfer");
  const dstTxids = await xfer.completeTransfer(dst.signer);
  console.log(`Completed Transfer: `, dstTxids);
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/cctp.ts#L82)
<!--EXAMPLE_CCTP_TRANSFER-->


### Gateway Transfers

Gateway transfers are transfers that are passed through the Wormhole Gateway to or from Cosmos chains.

A transfer into Cosmos from outside cosmos will be automatically delivered to the destination via IBC from the Gateway chain (fka Wormchain)
<!--EXAMPLE_GATEWAY_INBOUND-->
```ts
  console.log(
    `Beginning transfer into Cosmos from ${src.chain.chain}:${src.address.address.toString()} to ${
      dst.chain.chain
    }:${dst.address.address.toString()}`,
  );

  const xfer = await GatewayTransfer.from(wh, {
    token: token,
    amount: amount,
    from: src.address,
    to: dst.address,
  } as GatewayTransferDetails);
  console.log("Created GatewayTransfer: ", xfer.transfer);

  const srcTxIds = await xfer.initiateTransfer(src.signer);
  console.log("Started transfer on source chain", srcTxIds);

  const attests = await xfer.fetchAttestation(600_000);
  console.log("Got Attestations", attests);
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/cosmos.ts#L120)
<!--EXAMPLE_GATEWAY_INBOUND-->

A transfer within Cosmos will use IBC to transfer from the origin to the Gateway chain, then out from the Gateway to the destination chain
<!--EXAMPLE_GATEWAY_INTERCOSMOS-->
```ts
  console.log(
    `Beginning transfer within cosmos from ${
      src.chain.chain
    }:${src.address.address.toString()} to ${dst.chain.chain}:${dst.address.address.toString()}`,
  );

  const xfer = await GatewayTransfer.from(wh, {
    token: token,
    amount: amount,
    from: src.address,
    to: dst.address,
  } as GatewayTransferDetails);
  console.log("Created GatewayTransfer: ", xfer.transfer);

  const srcTxIds = await xfer.initiateTransfer(src.signer);
  console.log("Started transfer on source chain", srcTxIds);

  const attests = await xfer.fetchAttestation(60_000);
  console.log("Got attests: ", attests);
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/cosmos.ts#L152)
<!--EXAMPLE_GATEWAY_INTERCOSMOS-->

A transfer leaving Cosmos will produce a VAA from the Gateway that must be manually redeemed on the destination chain 
<!--EXAMPLE_GATEWAY_OUTBOUND-->
```ts
  console.log(
    `Beginning transfer out of cosmos from ${
      src.chain.chain
    }:${src.address.address.toString()} to ${dst.chain.chain}:${dst.address.address.toString()}`,
  );

  const xfer = await GatewayTransfer.from(wh, {
    token: token,
    amount: amount,
    from: src.address,
    to: dst.address,
  } as GatewayTransferDetails);
  console.log("Created GatewayTransfer: ", xfer.transfer);
  const srcTxIds = await xfer.initiateTransfer(src.signer);
  console.log("Started transfer on source chain", srcTxIds);

  const attests = await xfer.fetchAttestation(600_000);
  console.log("Got attests", attests);

  // Since we're leaving cosmos, this is required to complete the transfer
  const dstTxIds = await xfer.completeTransfer(dst.signer);
  console.log("Completed transfer on destination chain", dstTxIds);
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/cosmos.ts#L184)
<!--EXAMPLE_GATEWAY_OUTBOUND-->


### Recovering Transfers

It may be necessary to recover a transfer that was abandoned before being completed. This can be done by instantiating the Transfer class with the `from` static method and passing one of several types of identifiers.

A `TransactionId` or `WormholeMessageId` may be used to recover the transfer

<!--EXAMPLE_RECOVER_TRANSFER-->
```ts
  // Rebuild the transfer from the source txid
  const xfer = await CircleTransfer.from(wh, txid);

  const attestIds = await xfer.fetchAttestation(60 * 60 * 1000);
  console.log("Got attestation: ", attestIds);

  const dstTxIds = await xfer.completeTransfer(signer);
  console.log("Completed transfer: ", dstTxIds);
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/cctp.ts#L132)
<!--EXAMPLE_RECOVER_TRANSFER-->

## Routes

While a specific `WormholeTransfer` may be used (TokenTransfer, CCTPTransfer, ...), it requires the developer know exactly which transfer type to use for a given request. 

To provide a more flexible and generic interface, the `Wormhole` class provides a method to produce a `RouteResolver` that can be configured with a set of possible routes to be supported.

<!--EXAMPLE_RESOLVER_CREATE-->
```ts
  // create new resolver, passing the set of routes to consider
  const resolver = wh.resolver([
    routes.TokenBridgeRoute, // manual token bridge
    routes.AutomaticTokenBridgeRoute, // automatic token bridge
    routes.CCTPRoute, // manual CCTP
    routes.AutomaticCCTPRoute, // automatic CCTP
    routes.AutomaticPorticoRoute, // Native eth transfers
  ]);
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/router.ts#L23)
<!--EXAMPLE_RESOLVER_CREATE-->

Once created, the resolver can be used to provide a list of input and possible output tokens.

<!--EXAMPLE_RESOLVER_LIST_TOKENS-->
```ts
  const sendToken = Wormhole.tokenId(sendChain, "native");

  // given the send token, what can we possibly get on the destination chain?
  const destTokens = await resolver.supportedDestinationTokens(sendToken, sendChain, destChain);
  console.log(
    "For the given source token and routes configured, the following tokens may be receivable: ",
    destTokens.map((t) => canonicalAddress(t)),
  );
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/router.ts#L34)
<!--EXAMPLE_RESOLVER_LIST_TOKENS-->

Once the tokens are selected, a `RouteTransferRequest` may be created to provide a list of routes that can fulfil the request

<!--EXAMPLE_REQUEST_CREATE-->
```ts
  // creating a transfer request fetches token details
  // since all routes will need to know about the tokens
  const tr = await routes.RouteTransferRequest.create(wh, {
    from: sender.address,
    to: receiver.address,
    source: sendToken,
    destination: destTokens.pop()!,
  });

  // resolve the transfer request to a set of routes that can perform it
  const foundRoutes = await resolver.findRoutes(tr);
  console.log("For the transfer parameters, we found these routes: ", foundRoutes);
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/router.ts#L50)
<!--EXAMPLE_REQUEST_CREATE-->

Choosing the best route is currently left to the developer but strategies might include sorting by output amount or expected time to complete the transfer (no estimate currently provided).

After choosing the best route, extra parameters like `amount`, `nativeGasDropoff`, and `slippage` can be passed, depending on the specific route selected and a quote can be retrieved with the validated request.

<!--EXAMPLE_REQUEST_VALIDATE-->
```ts
  console.log("This route offers the following default options", bestRoute.getDefaultOptions());
  // Specify the amount as a decimal string
  const amt = "0.5";
  // Create the transfer params for this request
  const transferParams = { amount: amt, options: { nativeGas: 0.1 } };

  // validate the transfer params passed, this returns a new type of ValidatedTransferParams
  // which (believe it or not) is a validated version of the input params
  // this new var must be passed to the next step, quote
  const validated = await bestRoute.validate(transferParams);
  if (!validated.valid) throw validated.error;
  console.log("Validated parameters: ", validated.params);

  // get a quote for the transfer, this too returns a new type that must
  // be passed to the next step, execute (if you like the quote)
  const quote = await bestRoute.quote(validated.params);
  if (!quote.success) throw quote.error;
  console.log("Best route quote: ", quote);
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/router.ts#L70)
<!--EXAMPLE_REQUEST_VALIDATE-->


Finally, assuming the quote looks good, the route can initiate the request with the quote and the `signer`

<!--EXAMPLE_REQUEST_INITIATE-->
```ts
    // Now the transfer may be initiated
    // A receipt will be returned, guess what you gotta do with that?
    const receipt = await bestRoute.initiate(sender.signer, quote);
    console.log("Initiated transfer with receipt: ", receipt);
```
See example [here](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/router.ts#L94)
<!--EXAMPLE_REQUEST_INITIATE-->

Note: See the `router.ts` example in the examples directory for a full working example


## See also

The tsdoc is available [here](https://wormhole-foundation.github.io/wormhole-sdk-ts/)
