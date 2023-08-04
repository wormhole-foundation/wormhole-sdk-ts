"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const connect_sdk_1 = require("@wormhole-foundation/connect-sdk");
const connect_sdk_solana_1 = require("@wormhole-foundation/connect-sdk-solana");
const connect_sdk_evm_1 = require("@wormhole-foundation/connect-sdk-evm");
const helpers_1 = require("./helpers");
(async function () {
    const NETWORK = connect_sdk_1.Network.TESTNET;
    const contexts = {
        [connect_sdk_1.Context.SOLANA]: connect_sdk_solana_1.SolanaContext,
        [connect_sdk_1.Context.EVM]: connect_sdk_evm_1.EvmContext,
    };
    const wh = new connect_sdk_1.Wormhole(NETWORK, contexts);
    const solAcct = (0, helpers_1.getSolSigner)();
    const senderChain = "solana";
    const senderAddress = solAcct.publicKey.toBase58();
    console.log(senderAddress);
    const ethAcct = (0, helpers_1.getEthSigner)(wh.mustGetProvider("goerli"));
    const receiverChain = "goerli";
    const receiverAddress = ethAcct.address;
    // Prepare the transactions to start a transfer across chains
    const xfer = await wh.startTransfer("native", 100n, senderChain, senderAddress, receiverChain, receiverAddress);
    console.log(xfer);
    // ...
})();
//# sourceMappingURL=index.js.map