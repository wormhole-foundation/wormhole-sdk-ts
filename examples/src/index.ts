import { getNetworkInfo, Network as INetwork } from "@injectivelabs/networks";
import {
  PrivateKey,
  TxGrpcApi,
  ChainRestAuthApi,
  createTransaction,
  Msgs,
  MsgExecuteContractCompat,
  DEFAULT_STD_FEE,
} from "@injectivelabs/sdk-ts";
import {
  ChainAddress,
  ChainName,
  Network,
  Wormhole,
  toNative,
} from "@wormhole-foundation/connect-sdk";

// read in from `.env`
require("dotenv").config();

import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import {
  CosmwasmChain,
  CosmwasmPlatform,
  CosmwasmUnsignedTransaction,
  cosmwasmNetworkChainToChainId,
} from "@wormhole-foundation/connect-sdk-cosmwasm";

function getEndPoint(network: string) {
  return network === "Mainnet" ? INetwork.MainnetK8s : INetwork.TestnetK8s;
}
(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const network: Network = "Testnet";
  const wh = new Wormhole(network, [
    EvmPlatform,
    SolanaPlatform,
    CosmwasmPlatform,
  ]);

  const chain: ChainName = "Injective";
  const chainCtx: CosmwasmChain = wh.getChain(chain) as CosmwasmChain;
  const chainId = cosmwasmNetworkChainToChainId(network, chain)[0];

  const tb = await chainCtx.getTokenBridge();

  // init clients
  const inet = getNetworkInfo(getEndPoint(network));
  const txService = new TxGrpcApi(inet.grpc);
  const authRest = new ChainRestAuthApi(inet.rest);

  // Set up wallet
  const walletPK = PrivateKey.fromMnemonic(process.env.COSMOS_MNEMONIC!);
  const walletInjAddr = walletPK.toBech32();
  const walletPublicKey = walletPK.toPublicKey().toBase64();
  const walletAddr = toNative(chain, walletInjAddr);

  // get account details
  const { account } = await authRest.fetchAccount(walletInjAddr);
  const accountNumber = parseInt(account.base_account.account_number, 10);
  let sequence = parseInt(account.base_account.sequence, 10);

  const receiver = {
    chain: "Ethereum",
    address: toNative("Ethereum", "0x6603b4a7E29DfBDB6159c395a915e74757c1FB13"),
  } as ChainAddress;

  //
  console.log("creating transaction...");
  const xfer = tb.transfer(walletAddr, receiver, "native", 1_000_000n);

  for await (const msg of xfer) {
    const { transaction } = msg as CosmwasmUnsignedTransaction;

    // need to set contractAddress and msg
    const message: Msgs[] = transaction.msgs.map((m) => {
      const f = {
        ...m.value,
        msg: JSON.parse(Buffer.from(m.value.msg).toString()),
        contractAddress: m.value.contract,
      };
      return new MsgExecuteContractCompat(f);
    });

    const { signBytes, txRaw } = createTransaction({
      message: message,
      memo: transaction.memo,
      fee: DEFAULT_STD_FEE,
      pubKey: walletPublicKey,
      sequence,
      accountNumber,
      chainId,
    });
    txRaw.signatures = [await walletPK.sign(Buffer.from(signBytes))];

    /** Simulate transaction */
    console.log("Simulating transaction...");
    const simulationResponse = await txService.simulate(txRaw);
    console.log(
      `Transaction simulation response: ${JSON.stringify(
        simulationResponse.gasInfo
      )}`
    );

    /** Broadcast transaction */
    // const txResponse = await txService.broadcast(txRaw);
    // console.log(
    //   `Broadcasted transaction hash: ${JSON.stringify(txResponse.txHash)}`
    // );
    sequence += 1;
  }
})();
