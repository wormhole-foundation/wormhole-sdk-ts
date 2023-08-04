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

(async function () {
  const NETWORK = Network.TESTNET;
  const contexts = {
    [Context.SOLANA]: SolanaContext,
    [Context.EVM]: EvmContext,
  };

  const wh = new Wormhole(NETWORK, contexts);

  const senderChain = "solana";
  const receiverChain = "goerli";

  // strongarm it
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
  // const xfer: Transaction = await wh.startTransfer(
  //   "native",
  //   100n,
  //   senderChain,
  //   senderAddress,
  //   receiverChain,
  //   receiverAddress
  // );

  // xfer.partialSign(solAcct);
  // console.log(xfer);

  // const txid = await sendCtx.connection?.sendRawTransaction(xfer.serialize());
  // console.log(txid);

  //const txid =
  //  "H1cFY6unJjxbFGmTKC6Dxefn5UA7Nk4rUiszTTE2XNkaxQH4xpjSQ6Ar99HeEWA358ocgQoDn9Q1s3vrsSwofso";

  //const res = await sendCtx.parseMessageFromTx(txid, senderChain);
  //console.log(res);

  // ...

  const msgpayload =
    "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKBpuIV/6rgYT7aH9jRhjANdrEOdwa6ztVmKDwAAAAAAEAAQAAAAAAAAAAAAAAAGpGQGX4F73XKlIf5ci1+UdWkYj2AAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
  const payload = Buffer.from(msgpayload, "base64");
  const x = parseTokenTransferPayload(payload);
  console.log(x);

  console.log(BigInt("1"));
  console.log(BigInt("0x0a"));
})();

export function parseTokenTransferPayload(payload: Buffer): TokenTransfer {
  const payloadType = payload.readUInt8(0);
  if (
    payloadType != TokenBridgePayload.Transfer &&
    payloadType != TokenBridgePayload.TransferWithPayload
  ) {
    throw new Error("not token bridge transfer VAA");
  }
  console.log(payload.subarray(1, 33).toString("hex"));
  console.log(payload);

  const amount = BigInt(`0x${payload.subarray(1, 33).toString("hex")}`);
  const tokenAddress = payload.subarray(33, 65);
  const tokenChain = payload.readUInt16BE(65);
  const to = payload.subarray(67, 99);
  const toChain = payload.readUInt16BE(99);
  const fee =
    payloadType == 1
      ? BigInt(`0x${payload.subarray(101, 133).toString("hex")}`)
      : null;
  const fromAddress = payloadType == 3 ? payload.subarray(101, 133) : null;
  const tokenTransferPayload = payload.subarray(133);
  return {
    payloadType,
    amount,
    tokenAddress,
    tokenChain,
    to,
    toChain,
    fee,
    fromAddress,
    tokenTransferPayload,
  };
}
