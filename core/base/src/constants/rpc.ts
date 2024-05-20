import type { MapLevels } from "./../utils/index.js";
import { constMap } from "./../utils/index.js";
import type { Network } from "./networks.js";
import type { Chain } from "./chains.js";

// prettier-ignore
const rpcConfig = [[
  "Mainnet", [
    ["Ethereum",  "https://rpc.ankr.com/eth"],
    ["Solana",    "https://api.mainnet-beta.solana.com"],
    ["Polygon",   "https://rpc.ankr.com/polygon"],
    ["Bsc",       "https://bscrpc.com"],
    ["Avalanche", "https://rpc.ankr.com/avalanche"],
    ["Fantom",    "https://rpc.ankr.com/fantom"],
    ["Celo",      "https://rpc.ankr.com/celo"],
    ["Moonbeam",  "https://rpc.ankr.com/moonbeam"],
    ["Sui",       "https://rpc.mainnet.sui.io"],
    ["Aptos",     "https://fullnode.mainnet.aptoslabs.com/v1"],
    ["Arbitrum",  "https://arb1.arbitrum.io/rpc"],
    ["Optimism",  "https://mainnet.optimism.io"],
    ["Base",      "https://mainnet.base.org"],
    ["Osmosis",   "https://osmosis-rpc.polkachu.com"],
    ["Cosmoshub", "https://cosmos-rpc.publicnode.com:443"],
    ["Evmos",     "https://evmos-rpc.polkachu.com"],
    ["Injective", "https://sentry.tm.injective.network"],
    ["Wormchain", "https://wormchain-rpc.quickapi.com"],
    ["Xpla",      "https://dimension-rpc.xpla.dev"],
    ["Sei",       "https://sei-rpc.polkachu.com/"],
    ["Algorand",  "https://mainnet-api.algonode.cloud"],
    ["Terra",     "https://terra-classic-rpc.publicnode.com"],
    ["Terra2",    "https://terra-rpc.polkachu.com"],
    ["Karura",    "https://eth-rpc-karura.aca-api.network"],
    ["Acala",     "https://eth-rpc-acala.aca-api.network"],
    ["Oasis",     "https://emerald.oasis.dev"],
    ["Dymension", "https://dymension-rpc.polkachu.com/"],
    ["Stargaze",  "https://stargaze-rpc.polkachu.com/"],
    ["Celestia",  "https://celestia-rpc.polkachu.com/"],
    ["Neutron",   "https://neutron-rpc.polkachu.com/"],
    ["Blast",     "https://rpc.blast.io"],
    ["Provenance","https://rpc.provenance.io/"],
    ["Linea",     "https://rpc.linea.build"],
    ["Scroll",    "https://rpc.ankr.com/scroll"],
    ["Xlayer",    "https://xlayerrpc.okx.com/"],
    ["Gnosis",    "https://rpc.ankr.com/gnosis"],
    ["Rootstock", "https://public-node.rsk.co"],
  ]], [
  "Testnet", [
    ["Ethereum",        "https://eth-goerli.public.blastapi.io"],
    ["Polygon",         "https://rpc-mumbai.polygon.technology"],
    ["Bsc",             "https://data-seed-prebsc-1-s3.binance.org:8545"],
    ["Avalanche",       "https://api.avax-test.network/ext/bc/C/rpc"],
    ["Fantom",          "https://rpc.ankr.com/fantom_testnet"],
    ["Celo",            "https://alfajores-forno.celo-testnet.org"],
    ["Solana",          "https://api.devnet.solana.com"],
    ["Oasis",           "https://testnet.emerald.oasis.io"],
    ["Moonbeam",        "https://rpc.api.moonbase.moonbeam.network"],
    ["Sui",             "https://fullnode.testnet.sui.io"],
    ["Aptos",           "https://fullnode.testnet.aptoslabs.com/v1"],
    ["Sei",             "https://sei-testnet-rpc.polkachu.com"],
    ["Arbitrum",        "https://arbitrum-goerli.public.blastapi.io"],
    ["Optimism",        "https://optimism-goerli.public.blastapi.io"],
    ["Base",            "https://base-goerli.public.blastapi.io"],
    ["Injective",       "https://testnet.sentry.tm.injective.network"],
    ["Osmosis",         "https://rpc.testnet.osmosis.zone"],
    ["Cosmoshub",       "https://rpc.sentry-02.theta-testnet.polypore.xyz"],
    ["Evmos",           "https://evmos-testnet-rpc.polkachu.com"],
    ["Wormchain",       "https://gateway.testnet.xlabs.xyz/"],
    ["Xpla",            "https://cube-rpc.xpla.dev"],
    ["Sepolia",         "https://ethereum-sepolia.publicnode.com"],
    ["Algorand",        "https://testnet-api.algonode.cloud"],
    ["Terra",           "https://bombay.stakesystems.io"],
    ["Terra2",          "https://terra-testnet-rpc.polkachu.com"],
    ["ArbitrumSepolia", "https://sepolia-rollup.arbitrum.io/rpc"],
    ["OptimismSepolia", "https://sepolia.optimism.io"],
    ["BaseSepolia",     "https://sepolia.base.org"],
    ["PolygonSepolia",  "https://rpc-amoy.polygon.technology/"],
    ["Mantle",          "https://mantle-sepolia.drpc.org"],
    ["Karura",          "https://eth-rpc-karura-testnet.aca-staging.network"],
    ["Acala",           "https://eth-rpc-acala-testnet.aca-staging.network"],
    ["Blast",           "https://sepolia.blast.io"],
    ["Berachain",       "https://artio.rpc.berachain.com"],
    ["Linea",           "https://rpc.sepolia.linea.build"],
    ["Xlayer",          "https://testrpc.xlayer.tech/"],
    ["Scroll",          "https://rpc.ankr.com/scroll_sepolia_testnet"],
    ["Rootstock",       "https://public-node.testnet.rsk.co"],
    ["Gnosis",          "https://1rpc.io/gnosis"]
  ]], [
  "Devnet", [
    ["Ethereum",  "http://eth-devnet:8545"],
    ["Bsc",       "http://eth-devnet2:8545"],
    ["Solana",    "http://solana-devnet:8899"],
  ]],
] as const satisfies MapLevels<[Network, Chain, string]>;

const rpc = constMap(rpcConfig);

/** Default RPC Addresses by network and chain */
export const rpcAddress = (network: Network, chain: Chain) => rpc.get(network, chain) ?? "";
