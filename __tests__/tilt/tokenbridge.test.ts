import { CONFIG, ChainConfig, Wormhole, WormholeConfig, isWormholeMessageId, nativeChainAddress, normalizeAmount } from "@wormhole-foundation/connect-sdk";
import { signSendWait } from "@wormhole-foundation/connect-sdk/src";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { getEvmSigner, getSolSigner, getStuff } from './helpers';

type ConfigOverride = {
    [key: string]: Partial<ChainConfig>
}

function overrideChainSetting(conf: WormholeConfig, overrides: ConfigOverride): WormholeConfig {
    for (const [cn, oride] of Object.entries(overrides)) {
        // @ts-ignore
        conf.chains[cn] = { ...conf.chains[cn], ...oride }
    }
    return conf
}

const network = "Devnet"
const allPlatformCtrs = [SolanaPlatform, EvmPlatform];
const conf = overrideChainSetting(CONFIG[network], {
    "Ethereum": { "rpc": "http://localhost:8545" },
    "Bsc": { "rpc": "http://localhost:8546" },
    "Solana": { "rpc": "http://localhost:8899" }
})

jest.setTimeout(10 * 60 * 1000)
describe("Tilt Token Bridge Tests", () => {
    let wh: Wormhole;
    beforeAll(() => {
        wh = new Wormhole(network, allPlatformCtrs, conf)
    });

    test("Ethereum To Solana", async () => {
        const eth = wh.getChain("Ethereum");
        const sol = wh.getChain("Solana")

        const { signer: evmSigner, address: evmAcct } = await getStuff(eth);
        const { signer: solSigner, address: solAcct } = await getStuff(sol)

        const etb = await eth.getTokenBridge()
        const stb = await sol.getTokenBridge()

        const wrappedNativeToken = await etb.getWrappedNative()

        // Check if a wrapped version exists, if not, created it
        const wrappedExists = await stb.hasWrappedAsset({ chain: eth.chain, address: wrappedNativeToken })
        if (!wrappedExists) {
            // Create attestation txns
            const attest = etb.createAttestation(await etb.getWrappedNative())
            // Sign/send
            const txns = await signSendWait(eth, attest, evmSigner)
            // Get the wormhole message id
            const [msgid] = await eth.parseTransaction(txns[txns.length - 1].txid)
            // Get the VAA, deserialized to payload type of AttestMeta
            const vaa = await wh.getVAA(msgid.chain, msgid.emitter, msgid.sequence, "AttestMeta")
            // Create the submit attestation txns
            const completeAttest = stb.submitAttestation(vaa!, solAcct.address)
            // Sign/send
            const solTxns = await signSendWait(sol, completeAttest, solSigner)
            expect(solTxns.length).toEqual(3)
        }

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
        // Check chain/emitter/seq?

        const completed = await xfer.completeTransfer(solSigner)
        // incoming to solana is 3 transactions
        expect(completed.length).toEqual(3)
    })

});
