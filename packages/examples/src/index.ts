import {
  Wormhole,
  Context,
  Network,
  TokenTransfer,
  TokenBridgePayload,
} from "@wormhole-foundation/connect-sdk";
import { SolanaContext } from "@wormhole-foundation/connect-sdk-solana";
import { Transaction } from "@solana/web3.js";
import { EvmContext } from "@wormhole-foundation/connect-sdk-evm";
import { getSolSigner, getEthSigner } from "./helpers";

/*
TODO:
  - why specify network as first arg and allow it in config?
  - why require both `Context.SOLANA` and `SolanaContext`, not 
      just pass a list of Context constructors?
  - get typed context back from `getContext`
  - get connection/provider/rpc service correctly typed from the context

*/

(async function () {
  const NETWORK = Network.TESTNET;
  const contexts = {
    [Context.SOLANA]: SolanaContext,
    [Context.EVM]: EvmContext,
  };

  const wh = new Wormhole(NETWORK, contexts);

  const senderChain = "solana";
  const receiverChain = "goerli";

  // strong-arm the type
  const sendCtx: SolanaContext = wh.getContext(
    senderChain
  ) as unknown as SolanaContext;

  const rcvCtx: EvmContext = wh.getContext(
    receiverChain
  ) as unknown as EvmContext;

  // TODO: why cant I just get this from the context?
  const ethProvider = wh.mustGetProvider(receiverChain);

  const solAcct = getSolSigner();
  const senderAddress = solAcct.publicKey.toBase58();

  const ethAcct = getEthSigner(ethProvider);
  const receiverAddress = ethAcct.address;

  // Prepare the transactions to start a transfer across chains
  const xfer: Transaction = await wh.startTransfer(
    "native",
    100n,
    senderChain,
    senderAddress,
    receiverChain,
    receiverAddress
  );

  // TODO: forcing dev to get the conn out of the context is :(

  // Sign and send
  xfer.partialSign(solAcct);
  const txid = await sendCtx.connection!.sendRawTransaction(xfer.serialize());

  // Get deets from tx logs
  const msgs = await sendCtx.parseMessageFromTx(txid, senderChain);
  if (msgs.length === 0)
    throw new Error("No messages found in transaction logs");

  const { sequence, fromChain: emitterChain, emitterAddress } = msgs[0];

  // Get signed VAA from api
  const vaa = await wh.getVAA({
    // TODO: allow either type
    sequence: sequence.toString(),
    emitterAddress,
    // TODO: allow either type, dont require conversion to id
    emitterChain: wh.toChainId(emitterChain),
  });

  if (vaa === undefined)
    throw new Error("No VAA Found, maybe waiting for finality");

  // TODO: this is required for complete transfer on evm
  // we _should_ make methods to return unsigned txs instead
  wh.registerSigner(receiverChain, ethAcct);
  const completeXfer = await wh.completeTransfer(
    receiverChain,
    new Uint8Array(vaa),
    // TODO: why is this required param?
    undefined
  );

  console.log(completeXfer);

  // ...
})();
