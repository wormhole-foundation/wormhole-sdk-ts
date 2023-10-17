import { CONFIG, ChainConfig, ChainContext, ChainName, PlatformName, Wormhole, WormholeConfig, normalizeAmount } from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";


function overrideChainSetting(conf: WormholeConfig, chain: ChainName, setting: keyof ChainConfig, value: any): WormholeConfig {
    // @ts-ignore
    conf.chains[chain] = { ...conf.chains[chain], [setting]: value }
    return conf
}

async function getNative(chain: ChainContext<PlatformName>): Promise<string> {
    try {
        const tb = await chain.getTokenBridge()
        const addy = await tb.getWrappedNative()
        return addy.toString()
    } catch (e) {
        console.error("Could not get native for: ", chain.chain)
        console.error(e)
    }
    return ""
}

(async function () {
    const network = "Devnet"

    let cnf: WormholeConfig = CONFIG[network]
    cnf = overrideChainSetting(cnf, "Ethereum", "rpc", "http://localhost:8545")
    cnf = overrideChainSetting(cnf, "Bsc", "rpc", "http://localhost:8546")
    cnf = overrideChainSetting(cnf, "Solana", "rpc", "http://localhost:8899")

    const wh = new Wormhole(network, [EvmPlatform, SolanaPlatform], cnf);


    const eth = wh.getChain("Ethereum");
    const bsc = wh.getChain("Bsc")
    const sol = wh.getChain("Solana")

    console.log(await getNative(eth))
    console.log(await getNative(bsc))
    console.log(await getNative(sol))
})();