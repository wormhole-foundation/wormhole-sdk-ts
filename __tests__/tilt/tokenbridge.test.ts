// import {
//     ChainAddress,
//     Chain,
//     NativeAddress,
//     Platform,
//     Signer,
//     TokenBridge,
//     TokenId,
//     TokenTransfer,
//     Wormhole,
//     WormholeMessageId,
//     isWormholeMessageId,
//     normalizeAmount,
//     signSendWait,
// } from "@wormhole-foundation/connect-sdk";
// import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
// import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
// import { CosmwasmPlatform } from "@wormhole-foundation/connect-sdk-cosmwasm";
//
// import { expect, jest, describe, test } from '@jest/globals';
//
// import { TEST_ERC20, TEST_SOLANA_TOKEN, getStuff } from './helpers';
//
//
// jest.setTimeout(10 * 60 * 1000)
//
// const network = "Devnet"
// const allPlatforms = [SolanaPlatform, EvmPlatform, CosmwasmPlatform];
//
// const e2es: [Chain, Chain, string][] = [
//     ["Ethereum", "Solana", "native"],
//     ["Ethereum", "Solana", TEST_ERC20],
//     ["Solana", "Ethereum", "native"],
//     ["Solana", "Ethereum", TEST_SOLANA_TOKEN],
// ]
//
// describe("Token Bridge E2E Tests", () => {
//     const wh = new Wormhole(network, allPlatforms)
//
//     describe.each(e2es)('%s to %s (%s)', (srcChain, dstChain, tokenToSend) => {
//         const src = wh.getChain(srcChain);
//         const dst = wh.getChain(dstChain)
//
//         let srcSigner: Signer;
//         let dstSigner: Signer;
//
//         let srcAcct: ChainAddress;
//         let dstAcct: ChainAddress;
//
//         let srcTb: TokenBridge<Platform>;
//         let dstTb: TokenBridge<Platform>;
//
//         let tokenAddress: NativeAddress<Platform>;
//         let token: TokenId;
//         let tokenOrNative: TokenId | "native";
//
//
//         let srcBalanceToken: NativeAddress<Platform> | "native";
//         let dstBalanceToken: NativeAddress<Platform>;
//
//         beforeAll(async () => {
//             const srcStuff = await getStuff(src);
//             srcSigner = srcStuff.signer
//             srcAcct = srcStuff.address
//
//             const dstStuff = await getStuff(dst)
//             dstSigner = dstStuff.signer
//             dstAcct = dstStuff.address
//
//             srcTb = await src.getTokenBridge();
//             dstTb = await dst.getTokenBridge();
//
//             tokenAddress = tokenToSend === "native" ? await srcTb.getWrappedNative() : wh.parseAddress(srcChain, tokenToSend)
//             srcBalanceToken = tokenToSend === "native" ? "native" : tokenAddress
//
//             token = { chain: srcChain, address: tokenAddress }
//             tokenOrNative = tokenToSend === "native" ? "native" : token
//         })
//
//
//         describe("Attest Token", () => {
//             let msgid: WormholeMessageId;
//             let wrappedExists: boolean;
//             test(`Check if the wrapped token exists on ${dstChain}`, async () => {
//                 wrappedExists = await dstTb.hasWrappedAsset(token)
//                 expect(wrappedExists).toBeDefined()
//             })
//
//             test(`Create attestation VAA on ${srcChain}`, async () => {
//                 const attest = srcTb.createAttestation(tokenAddress, srcAcct.address)
//                 const txns = await signSendWait(src, attest, srcSigner)
//                 expect(txns).toHaveLength(1)
//
//                 const msgs = await src.parseTransaction(txns[txns.length - 1].txid)
//                 expect(msgs).toHaveLength(1)
//
//                 msgid = msgs[0]
//                 expect(isWormholeMessageId(msgid)).toBeTruthy()
//             })
//
//             test(`Create or update wrapped on ${dstChain}`, async () => {
//                 const vaa = await wh.getVaa(msgid.chain, msgid.emitter, msgid.sequence, "TokenBridge:AttestMeta")
//                 expect(vaa).toBeTruthy()
//
//                 const completeAttest = dstTb.submitAttestation(vaa!, dstAcct.address)
//                 const dstTxns = await signSendWait(dst, completeAttest, dstSigner)
//                 expect(dstTxns.length).toBeGreaterThanOrEqual(1)
//             })
//
//             test(`Lookup wrapped on ${dstChain}`, async () => {
//                 dstBalanceToken = await dstTb.getWrappedAsset(token)
//                 expect(dstBalanceToken).toBeDefined()
//             })
//         })
//
//
//         describe('Token Transfer', () => {
//             let amt: bigint;
//             let bridgedAmt: bigint;
//
//             let senderBalance: bigint;
//             let receiverBalance: bigint;
//
//             let xfer: TokenTransfer;
//             test(`Create transfer: ${srcChain} to ${dstChain}`, async () => {
//                 const decimals = await wh.getDecimals(srcChain, srcBalanceToken)
//                 amt = normalizeAmount("1", decimals)
//                 // scale the amt by the difference in number of decimals for balance checks
//                 // Since ethereum allows >8 decimals, we have to get the decimals from the dst chain
//                 const bridgedDecimals = await wh.getDecimals(dstChain, dstBalanceToken)
//                 bridgedAmt = amt / 10n ** (decimals - bridgedDecimals)
//
//                 xfer = await wh.tokenTransfer(tokenOrNative, amt, srcAcct, dstAcct, false)
//                 const { transfer, txids } = xfer;
//                 expect(txids.length).toEqual(0)
//                 expect(transfer.from).toEqual(srcAcct)
//                 expect(transfer.amount).toEqual(amt)
//                 expect(transfer.automatic).toBeFalsy()
//                 expect(transfer.token).toEqual(tokenOrNative)
//
//                 senderBalance = (await wh.getBalance(srcChain, srcBalanceToken, srcAcct.address.toString()))!
//                 expect(senderBalance).toBeGreaterThan(0)
//
//                 receiverBalance = (await wh.getBalance(dstChain, dstBalanceToken, dstAcct.address.toString()))!
//                 expect(receiverBalance).toBeGreaterThan(0)
//             })
//
//             test(`Initiate transfer: ${srcChain} to ${dstChain}`, async () => {
//                 const srcTxIds = await xfer.initiateTransfer(srcSigner)
//                 expect(srcTxIds.length).toBeGreaterThanOrEqual(1)
//                 expect(xfer.txids.length).toEqual(srcTxIds.length)
//
//
//                 const senderBalanceAfter = (await wh.getBalance(srcChain, srcBalanceToken, srcAcct.address.toString()))!
//                 if (srcBalanceToken === "native") {
//                     // account for gas cost
//                     expect(senderBalanceAfter).toBeLessThan(senderBalance - amt)
//                 } else {
//                     expect(senderBalanceAfter).toEqual(senderBalance - amt)
//                 }
//                 senderBalance = senderBalanceAfter;
//
//                 const receiverBalanceAfter = (await wh.getBalance(dstChain, dstBalanceToken, dstAcct.address.toString()))!
//                 expect(receiverBalanceAfter).toEqual(receiverBalance)
//             })
//
//             test(`Fetch attestation: ${srcChain} to ${dstChain}`, async () => {
//                 const atts = await xfer.fetchAttestation(60_000)
//                 expect(atts.length).toEqual(1)
//
//                 const [att] = atts
//                 expect(isWormholeMessageId(att)).toBeTruthy()
//
//                 expect(xfer.vaas).toBeTruthy()
//                 expect(xfer.vaas!.length).toEqual(1)
//                 expect(xfer.vaas![0].vaa).toBeTruthy()
//             })
//
//             test(`Complete transfer: ${srcChain} to ${dstChain}`, async () => {
//                 const dstTxIds = await xfer.completeTransfer(dstSigner)
//                 expect(dstTxIds.length).toBeGreaterThanOrEqual(1)
//
//                 const senderBalanceAfter = (await wh.getBalance(srcChain, srcBalanceToken, srcAcct.address.toString()))!
//                 expect(senderBalanceAfter).toEqual(senderBalance)
//
//                 const receiverBalanceAfter = (await wh.getBalance(dstChain, dstBalanceToken, dstAcct.address.toString()))!
//                 expect(receiverBalanceAfter).toEqual(receiverBalance + bridgedAmt)
//             })
//
//             test(`Is Transfer Redeemed: ${srcChain} to ${dstChain}`, async () => {
//                 const { vaa } = xfer.vaas![0]
//                 const isCompleted = await dstTb.isTransferCompleted(vaa!)
//                 expect(isCompleted).toBeTruthy()
//             })
//         })
//     })
// });
//
