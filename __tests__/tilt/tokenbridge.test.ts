import {
    ChainAddress,
    NativeAddress,
    PlatformName,
    Signer,
    TokenBridge,
    Wormhole,
    isWormholeMessageId,
    normalizeAmount,
} from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaAddress, SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { signSendWait } from "@wormhole-foundation/connect-sdk/src";
import { getStuff } from './helpers';

jest.setTimeout(10 * 60 * 1000)

const network = "Devnet"
const allPlatforms = [SolanaPlatform, EvmPlatform];

describe("Tilt Token Bridge Tests", () => {
    const wh = new Wormhole(network, allPlatforms)


    describe("Ethereum To Solana", () => {
        const src = wh.getChain("Ethereum");
        const dst = wh.getChain("Solana")

        let srcSigner: Signer;
        let dstSigner: Signer;

        let srcAcct: ChainAddress;
        let dstAcct: ChainAddress;

        let srcTb: TokenBridge<PlatformName>;
        let dstTb: TokenBridge<PlatformName>;
        let wrappedNativeToken: NativeAddress<PlatformName>;

        beforeAll(async () => {
            const srcStuff = await getStuff(src);
            srcSigner = srcStuff.signer
            srcAcct = srcStuff.address

            const dstStuff = await getStuff(dst)
            dstSigner = dstStuff.signer
            dstAcct = dstStuff.address

            srcTb = await src.getTokenBridge()
            dstTb = await dst.getTokenBridge()

            wrappedNativeToken = await srcTb.getWrappedNative()
        })

        test("Create Wrapped", async () => {
            // TODO: should we make sure its a clean env? should we update if it already exists?
            const wrappedExists = await dstTb.hasWrappedAsset({ chain: src.chain, address: wrappedNativeToken })
            if (wrappedExists) return

            const attest = srcTb.createAttestation(wrappedNativeToken)
            const txns = await signSendWait(src, attest, srcSigner)
            expect(txns).toHaveLength(1)

            const [msgid] = await src.parseTransaction(txns[txns.length - 1].txid)
            expect(isWormholeMessageId(msgid)).toBeTruthy()

            const vaa = await wh.getVAA(msgid.chain, msgid.emitter, msgid.sequence, "TokenBridge:AttestMeta")
            expect(vaa).toBeTruthy()

            const completeAttest = dstTb.submitAttestation(vaa!, dstAcct.address)
            const solTxns = await signSendWait(dst, completeAttest, dstSigner)
            expect(solTxns.length).toBeGreaterThanOrEqual(1)
        })

        test("Send Native Transfer", async () => {
            const amt = normalizeAmount("1", src.config.nativeTokenDecimals)

            const xfer = await wh.tokenTransfer("native", amt, srcAcct, dstAcct, false)
            expect(xfer.txids.length).toEqual(0)
            expect(xfer.transfer.from).toEqual(srcAcct)

            const txids = await xfer.initiateTransfer(srcSigner)
            expect(txids.length).toBeGreaterThanOrEqual(1)
            expect(xfer.txids.length).toEqual(txids.length)

            const atts = await xfer.fetchAttestation()
            expect(atts.length).toEqual(1)

            const [att] = atts
            expect(isWormholeMessageId(att)).toBeTruthy()

            const completed = await xfer.completeTransfer(dstSigner)
            expect(completed.length).toBeGreaterThanOrEqual(1)
        })
    })
});
