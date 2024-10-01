import type { MapLevels } from "./../../utils/index.js";
import type { Network } from "../networks.js";
import type { Chain } from "../chains.js";

// prettier-ignore
export const tokenBridgeContracts = [[
  "Mainnet", [
    ["Solana",    "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb"],
    ["Ethereum",  "0x3ee18B2214AFF97000D974cf647E7C347E8fa585"],
    ["Terra",     "terra10nmmwe8r3g99a9newtqa7a75xfgs2e8z87r2sf"],
    ["Bsc",       "0xB6F6D86a8f9879A9c87f643768d9efc38c1Da6E7"],
    ["Polygon",   "0x5a58505a96D1dbf8dF91cB21B54419FC36e93fdE"],
    ["Avalanche", "0x0e082F06FF657D94310cB8cE8B0D9a04541d8052"],
    ["Oasis",     "0x5848C791e09901b40A9Ef749f2a6735b418d7564"],
    ["Algorand",  "842126029"],
    ["Aurora",    "0x51b5123a7b0F9b2bA265f9c4C8de7D78D52f510F"],
    ["Fantom",    "0x7C9Fc5741288cDFdD83CeB07f3ea7e22618D79D2"],
    ["Karura",    "0xae9d7fe007b3327AA64A32824Aaac52C42a6E624"],
    ["Acala",     "0xae9d7fe007b3327AA64A32824Aaac52C42a6E624"],
    ["Kaia",      "0x5b08ac39EAED75c0439FC750d9FE7E1F9dD0193F"],
    ["Celo",      "0x796Dff6D74F3E27060B71255Fe517BFb23C93eed"],
    ["Near",      "contract.portalbridge.near"],
    ["Injective", "inj1ghd753shjuwexxywmgs4xz7x2q732vcnxxynfn"],
    ["Aptos",     "0x576410486a2da45eee6c949c995670112ddf2fbeedab20350d506328eefc9d4f"],
    ["Sui",       "0xc57508ee0d4595e5a8728974a4a93a787d38f339757230d441e895422c07aba9"],
    ["Moonbeam",  "0xb1731c586ca89a23809861c6103f0b96b3f57d92"],
    ["Terra2",    "terra153366q50k7t8nn7gec00hg66crnhkdggpgdtaxltaq6xrutkkz3s992fw9"],
    ["Arbitrum",  "0x0b2402144Bb366A632D14B83F244D2e0e21bD39c"],
    ["Optimism",  "0x1D68124e65faFC907325e3EDbF8c4d84499DAa8b"],
    ["Base",      "0x8d2de8d2f73F1F4cAB472AC9A881C9b123C79627"],
    ["Xlayer",    "0x5537857664B0f9eFe38C9f320F75fEf23234D904"],
    ["Xpla",      "xpla137w0wfch2dfmz7jl2ap8pcmswasj8kg06ay4dtjzw7tzkn77ufxqfw7acv"],
    ["Sei",       "sei1smzlm9t79kur392nu9egl8p8je9j92q4gzguewj56a05kyxxra0qy0nuf3"],
    ["Wormchain", "wormhole1466nf3zuxpya8q9emxukd7vftaf6h4psr0a07srl5zw74zh84yjq4lyjmh"],
    ["Blast",     "0x24850c6f61C438823F01B7A3BF2B89B72174Fa9d"],
    ["Scroll",    "0x24850c6f61C438823F01B7A3BF2B89B72174Fa9d"],
    ["Mantle",    "0x24850c6f61C438823F01B7A3BF2B89B72174Fa9d"],
    ["Snaxchain", "0x8B94bfE456B48a6025b92E11Be393BAa86e68410"],
  ]], [
  "Testnet", [
    ["Solana",          "DZnkkTmCiFWfYTfT41X3Rd1kDgozqzxWaHqsw6W4x2oe"],
    ["Ethereum",        "0xF890982f9310df57d00f659cf4fd87e65adEd8d7"],
    ["Terra",           "terra1pseddrv0yfsn76u4zxrjmtf45kdlmalswdv39a"],
    ["Bsc",             "0x9dcF9D205C9De35334D646BeE44b2D2859712A09"],
    ["Polygon",         "0x377D55a7928c046E18eEbb61977e714d2a76472a"],
    ["Avalanche",       "0x61E44E506Ca5659E6c0bba9b678586fA2d729756"],
    ["Oasis",           "0x88d8004A9BdbfD9D28090A02010C19897a29605c"],
    ["Algorand",        "86525641"],
    ["Aurora",          "0xD05eD3ad637b890D68a854d607eEAF11aF456fba"],
    ["Fantom",          "0x599CEa2204B4FaECd584Ab1F2b6aCA137a0afbE8"],
    ["Karura",          "0xe157115ef34c93145Fec2FE53706846853B07F42"],
    ["Acala",           "0xe157115ef34c93145Fec2FE53706846853B07F42"],
    ["Kaia",            "0xC7A13BE098720840dEa132D860fDfa030884b09A"],
    ["Celo",            "0x05ca6037eC51F8b712eD2E6Fa72219FEaE74E153"],
    ["Near",            "token.wormhole.testnet"],
    ["Injective",       "inj1q0e70vhrv063eah90mu97sazhywmeegp7myvnh"],
    ["Aptos",           "0x576410486a2da45eee6c949c995670112ddf2fbeedab20350d506328eefc9d4f"],
    ["Sui",             "0x6fb10cdb7aa299e9a4308752dadecb049ff55a892de92992a1edbd7912b3d6da"],
    ["Moonbeam",        "0xbc976D4b9D57E57c3cA52e1Fd136C45FF7955A96"],
    ["Neon",            "0xEe3dB83916Ccdc3593b734F7F2d16D630F39F1D0"],
    ["Terra2",          "terra1c02vds4uhgtrmcw7ldlg75zumdqxr8hwf7npseuf2h58jzhpgjxsgmwkvk"],
    ["Arbitrum",        "0x23908A62110e21C04F3A4e011d24F901F911744A"],
    ["ArbitrumSepolia", "0xC7A204bDBFe983FCD8d8E61D02b475D4073fF97e"],
    ["Optimism",        "0xC7A204bDBFe983FCD8d8E61D02b475D4073fF97e"],
    ["OptimismSepolia", "0x99737Ec4B815d816c49A385943baf0380e75c0Ac"],
    ["Xpla",            "xpla1kek6zgdaxcsu35nqfsyvs2t9vs87dqkkq6hjdgczacysjn67vt8sern93x"],
    ["Base",            "0xA31aa3FDb7aF7Db93d18DDA4e19F811342EDF780"],
    ["BaseSepolia",     "0x86F55A04690fd7815A3D802bD587e83eA888B239"],
    ["Sei",             "sei1jv5xw094mclanxt5emammy875qelf3v62u4tl4lp5nhte3w3s9ts9w9az2"],
    ["Sepolia",         "0xDB5492265f6038831E89f495670FF909aDe94bd9"],
    ["Wormchain",       "wormhole1aaf9r6s7nxhysuegqrxv0wpm27ypyv4886medd3mrkrw6t4yfcnst3qpex"],
    ["Holesky",         "0x76d093BbaE4529a342080546cAFEec4AcbA59EC6"],
    ["Mantle",          "0x75Bfa155a9D7A3714b0861c8a8aF0C4633c45b5D"],
    ["PolygonSepolia",  "0xC7A204bDBFe983FCD8d8E61D02b475D4073fF97e"],
    ["Scroll",          "0x22427d90B7dA3fA4642F7025A854c7254E4e45BF"],
    ["Blast",           "0x430855B4D43b8AEB9D2B9869B74d58dda79C0dB2"],
    ["Xlayer",          "0xdA91a06299BBF302091B053c6B9EF86Eff0f930D"],
    ["Berachain",       "0xa10f2eF61dE1f19f586ab8B6F2EbA89bACE63F7a"],
    ["Snaxchain",       "0xa10f2eF61dE1f19f586ab8B6F2EbA89bACE63F7a"],
    ["Linea",           "0xC7A204bDBFe983FCD8d8E61D02b475D4073fF97e"],
  ]], [
  "Devnet", [
    ["Solana",    "B6RHG3mfcckmrYN1UhmJzyS1XX3fZKbkeUcpJe9Sy3FE"],
    ["Ethereum",  "0x0290FB167208Af455bB137780163b7B7a9a10C16"],
    ["Terra",     "terra1nc5tatafv6eyq7llkr2gv50ff9e22mnf70qgjlv737ktmt4eswrquka9l6"],
    ["Bsc",       "0x0290FB167208Af455bB137780163b7B7a9a10C16"],
    ["Algorand",  "1006"],
    ["Near",      "token.test.near"],
    ["Aptos",     "0x84a5f374d29fc77e370014dce4fd6a55b58ad608de8074b0be5571701724da31"],
    ["Sui",       "0xa6a3da85bbe05da5bfd953708d56f1a3a023e7fb58e5a824a3d4de3791e8f690"],
    ["Terra2",    "terra1nc5tatafv6eyq7llkr2gv50ff9e22mnf70qgjlv737ktmt4eswrquka9l6"],
    ["Wormchain", "wormhole1ghd753shjuwexxywmgs4xz7x2q732vcnkm6h2pyv9s6ah3hylvrqtm7t3h"],
  ]],
] as const satisfies MapLevels<[Network, Chain, string]>;
