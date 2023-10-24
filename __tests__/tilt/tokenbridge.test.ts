import {
    ChainAddress,
    ChainName,
    NativeAddress,
    PlatformName,
    Signer,
    TokenBridge,
    TokenTransfer,
    Wormhole,
    WormholeMessageId,
    isWormholeMessageId,
    normalizeAmount,
    signSendWait,
} from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { CosmwasmPlatform } from "@wormhole-foundation/connect-sdk-cosmwasm";

import { expect, jest, describe, test } from '@jest/globals';

import { TEST_ERC20, TEST_SOLANA_TOKEN, getStuff } from './helpers';


jest.setTimeout(10 * 60 * 1000)

const network = "Devnet"
const allPlatforms = [SolanaPlatform, EvmPlatform, CosmwasmPlatform];

const e2es: [ChainName, ChainName, string][] = [
    ["Ethereum", "Solana", "native"],
    ["Ethereum", "Solana", TEST_ERC20],
    ["Solana", "Ethereum", "native"],
    ["Solana", "Ethereum", TEST_SOLANA_TOKEN],
]

describe("Token Bridge E2E Tests", () => {
    const wh = new Wormhole(network, allPlatforms)

    describe.each(e2es)('%s to %s', (srcChain, dstChain, tokenAddress) => {
        const src = wh.getChain(srcChain);
        const dst = wh.getChain(dstChain)

        let srcSigner: Signer;
        let dstSigner: Signer;

        let srcAcct: ChainAddress;
        let dstAcct: ChainAddress;

        let srcTb: TokenBridge<PlatformName>;
        let dstTb: TokenBridge<PlatformName>;

        let token: NativeAddress<PlatformName>;

        beforeAll(async () => {
            const srcStuff = await getStuff(src);
            srcSigner = srcStuff.signer
            srcAcct = srcStuff.address

            const dstStuff = await getStuff(dst)
            dstSigner = dstStuff.signer
            dstAcct = dstStuff.address

            srcTb = await src.getTokenBridge();
            dstTb = await dst.getTokenBridge();

            token = tokenAddress === "native" ? await srcTb.getWrappedNative() : wh.parseAddress(srcChain, tokenAddress)
        })

        describe("Attest Token", () => {
            let msgid: WormholeMessageId;
            let wrappedExists: boolean;
            test(`Check if the wrapped token exists on ${dstChain}`, async () => {
                wrappedExists = await dstTb.hasWrappedAsset({ chain: src.chain, address: token })
                // We should not have this token in a clean environment
                //expect(wrappedExists).toBeFalsy()
            })

            test(`Create attestation VAA on ${srcChain}`, async () => {
                const attest = srcTb.createAttestation(token, srcAcct.address)
                const txns = await signSendWait(src, attest, srcSigner)
                expect(txns).toHaveLength(1)

                const msgs = await src.parseTransaction(txns[txns.length - 1].txid)
                expect(msgs).toHaveLength(1)

                msgid = msgs[0]
                expect(isWormholeMessageId(msgid)).toBeTruthy()
            })

            test(`Create or update wrapped on ${dstChain}`, async () => {
                const vaa = await wh.getVAA(msgid.chain, msgid.emitter, msgid.sequence, "TokenBridge:AttestMeta")
                expect(vaa).toBeTruthy()

                const completeAttest = dstTb.submitAttestation(vaa!, dstAcct.address)
                const dstTxns = await signSendWait(dst, completeAttest, dstSigner)
                expect(dstTxns.length).toBeGreaterThanOrEqual(1)
            })
        })


        describe('Token Transfer', () => {
            const amt = normalizeAmount("1", src.config.nativeTokenDecimals)

            let xfer: TokenTransfer;
            test(`Create transfer: ${srcChain} to ${dstChain}`, async () => {
                xfer = await wh.tokenTransfer("native", amt, srcAcct, dstAcct, false)
                const { transfer, txids } = xfer;
                expect(txids.length).toEqual(0)
                expect(transfer.from).toEqual(srcAcct)
                expect(transfer.amount).toEqual(amt)
                expect(transfer.automatic).toBeFalsy()
                expect(transfer.token).toEqual("native")
            })
            test(`Initiate transfer: ${srcChain} to ${dstChain}`, async () => {
                // TODO: balance checks before and after
                const srcTxIds = await xfer.initiateTransfer(srcSigner)
                expect(srcTxIds.length).toBeGreaterThanOrEqual(1)
                expect(xfer.txids.length).toEqual(srcTxIds.length)
            })
            test(`Fetch attestation: ${srcChain} to ${dstChain}`, async () => {
                const atts = await xfer.fetchAttestation(60_000)
                expect(atts.length).toEqual(1)

                const [att] = atts
                expect(isWormholeMessageId(att)).toBeTruthy()

                expect(xfer.vaas).toBeTruthy()
                expect(xfer.vaas!.length).toEqual(1)
                expect(xfer.vaas![0].vaa).toBeTruthy()
            })
            test(`Complete transfer: ${srcChain} to ${dstChain}`, async () => {
                // TODO: balance checks before and after
                const dstTxIds = await xfer.completeTransfer(dstSigner)
                expect(dstTxIds.length).toBeGreaterThanOrEqual(1)
            })
            test(`Is Transfer Redeemed: ${srcChain} to ${dstChain}`, async () => {
                const { vaa } = xfer.vaas![0]
                const isCompleted = await dstTb.isTransferCompleted(vaa!)
                expect(isCompleted).toBeTruthy()
            })
        })
    })
});
