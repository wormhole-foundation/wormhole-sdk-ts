import {
    CONFIG,
    ChainAddress,
    NativeAddress,
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
        const eth = wh.getChain("Ethereum");
        const sol = wh.getChain("Solana")

        let evmSigner: Signer;
        let solSigner: Signer;

        let evmAcct: ChainAddress;
        let solAcct: ChainAddress;

        let etb: TokenBridge<"Evm">;
        let stb: TokenBridge<"Solana">;
        let wrappedNativeToken: NativeAddress<"Evm">;

        beforeAll(async () => {
            const evmStuff = await getStuff(eth);
            evmSigner = evmStuff.signer
            evmAcct = evmStuff.address

            const solStuff = await getStuff(sol)
            solSigner = solStuff.signer
            solAcct = solStuff.address

            etb = await eth.getTokenBridge() as TokenBridge<"Evm">
            stb = await sol.getTokenBridge() as TokenBridge<"Solana">

            wrappedNativeToken = await etb.getWrappedNative()
        })


        test("Create Wrapped", async () => {
            // TODO: should we make sure its a clean env? should we update if it already exists?

            // Check if a wrapped version exists, if not, created it
            const wrappedExists = await stb.hasWrappedAsset({ chain: eth.chain, address: wrappedNativeToken })
            if (wrappedExists) return

            const attest = etb.createAttestation(await etb.getWrappedNative())
            const txns = await signSendWait(eth, attest, evmSigner)
            expect(txns).toHaveLength(1)

            const [msgid] = await eth.parseTransaction(txns[txns.length - 1].txid)
            expect(isWormholeMessageId(msgid)).toBeTruthy()

            const vaa = await wh.getVAA(msgid.chain, msgid.emitter, msgid.sequence, "TokenBridge-AttestMeta")
            expect(vaa).toBeTruthy()

            const completeAttest = stb.submitAttestation(vaa!, solAcct.address as SolanaAddress)
            const solTxns = await signSendWait(sol, completeAttest, solSigner)
            expect(solTxns.length).toEqual(3)
        })

        test("Send Native Transfer", async () => {
            const amt = normalizeAmount("1", eth.config.nativeTokenDecimals)

            const xfer = await wh.tokenTransfer("native", amt, evmAcct, solAcct, false)
            expect(xfer.txids.length).toEqual(0)
            expect(xfer.transfer.amount).toEqual(BigInt("1" + "0".repeat(18)));
            expect(xfer.transfer.from).toEqual(evmAcct)

            const txids = await xfer.initiateTransfer(evmSigner)
            expect(txids.length).toEqual(1)
            expect(xfer.txids.length).toEqual(txids.length)
            expect(xfer.txids.map((txid) => txid.chain).every((c) => c === eth.chain))

            const atts = await xfer.fetchAttestation()
            expect(atts.length).toEqual(1)
            const [att] = atts
            expect(isWormholeMessageId(att)).toBeTruthy()

            const completed = await xfer.completeTransfer(solSigner)
            expect(completed.length).toEqual(3)
        })
    })
});
