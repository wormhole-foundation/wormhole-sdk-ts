import {Chain} from "./chains";
import {Network} from "./networks";
import {Module} from "./modules";

//TODO: having Sepolia (for mainnet and devnet) in here isn't particularly kosher
export const contracts = {
  Mainnet: {
    Solana: {
      CoreBridge: "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth",
      TokenBridge: "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb",
      NftBridge: "WnFt12ZrnzZrFZkt2xsNsaNWoQribnuQ5B5FrDbwDhD",
      Relayer: undefined,
    },
    Ethereum: {
      CoreBridge: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
      TokenBridge: "0x3ee18B2214AFF97000D974cf647E7C347E8fa585",
      NftBridge: "0x6FFd7EdE62328b3Af38FCD61461Bbfc52F5651fE",
      Relayer: undefined,
    },
    Terra: {
      CoreBridge: "terra1dq03ugtd40zu9hcgdzrsq6z2z4hwhc9tqk2uy5",
      TokenBridge: "terra10nmmwe8r3g99a9newtqa7a75xfgs2e8z87r2sf",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Bsc: {
      CoreBridge: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
      TokenBridge: "0xB6F6D86a8f9879A9c87f643768d9efc38c1Da6E7",
      NftBridge: "0x5a58505a96D1dbf8dF91cB21B54419FC36e93fdE",
      Relayer: undefined,
    },
    Polygon: {
      CoreBridge: "0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7",
      TokenBridge: "0x5a58505a96D1dbf8dF91cB21B54419FC36e93fdE",
      NftBridge: "0x90BBd86a6Fe93D3bc3ed6335935447E75fAb7fCf",
      Relayer: undefined,
    },
    Avalanche: {
      CoreBridge: "0x54a8e5f9c4CbA08F9943965859F6c34eAF03E26c",
      TokenBridge: "0x0e082F06FF657D94310cB8cE8B0D9a04541d8052",
      NftBridge: "0xf7B6737Ca9c4e08aE573F75A97B73D7a813f5De5",
      Relayer: undefined,
    },
    Oasis: {
      CoreBridge: "0xfE8cD454b4A1CA468B57D79c0cc77Ef5B6f64585",
      TokenBridge: "0x5848C791e09901b40A9Ef749f2a6735b418d7564",
      NftBridge: "0x04952D522Ff217f40B5Ef3cbF659EcA7b952a6c1",
      Relayer: undefined,
    },
    Algorand: {
      CoreBridge: "842125965",
      TokenBridge: "842126029",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Aurora: {
      CoreBridge: "0xa321448d90d4e5b0A732867c18eA198e75CAC48E",
      TokenBridge: "0x51b5123a7b0F9b2bA265f9c4C8de7D78D52f510F",
      NftBridge: "0x6dcC0484472523ed9Cdc017F711Bcbf909789284",
      Relayer: undefined,
    },
    Fantom: {
      CoreBridge: "0x126783A6Cb203a3E35344528B26ca3a0489a1485",
      TokenBridge: "0x7C9Fc5741288cDFdD83CeB07f3ea7e22618D79D2",
      NftBridge: "0xA9c7119aBDa80d4a4E0C06C8F4d8cF5893234535",
      Relayer: undefined,
    },
    Karura: {
      CoreBridge: "0xa321448d90d4e5b0A732867c18eA198e75CAC48E",
      TokenBridge: "0xae9d7fe007b3327AA64A32824Aaac52C42a6E624",
      NftBridge: "0xb91e3638F82A1fACb28690b37e3aAE45d2c33808",
      Relayer: undefined,
    },
    Acala: {
      CoreBridge: "0xa321448d90d4e5b0A732867c18eA198e75CAC48E",
      TokenBridge: "0xae9d7fe007b3327AA64A32824Aaac52C42a6E624",
      NftBridge: "0xb91e3638F82A1fACb28690b37e3aAE45d2c33808",
      Relayer: undefined,
    },
    Klaytn: {
      CoreBridge: "0x0C21603c4f3a6387e241c0091A7EA39E43E90bb7",
      TokenBridge: "0x5b08ac39EAED75c0439FC750d9FE7E1F9dD0193F",
      NftBridge: "0x3c3c561757BAa0b78c5C025CdEAa4ee24C1dFfEf",
      Relayer: undefined,
    },
    Celo: {
      CoreBridge: "0xa321448d90d4e5b0A732867c18eA198e75CAC48E",
      TokenBridge: "0x796Dff6D74F3E27060B71255Fe517BFb23C93eed",
      NftBridge: "0xA6A377d75ca5c9052c9a77ED1e865Cc25Bd97bf3",
      Relayer: undefined,
    },
    Near: {
      CoreBridge: "contract.wormhole_crypto.near",
      TokenBridge: "contract.portalbridge.near",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Injective: {
      CoreBridge: "inj17p9rzwnnfxcjp32un9ug7yhhzgtkhvl9l2q74d",
      TokenBridge: "inj1ghd753shjuwexxywmgs4xz7x2q732vcnxxynfn",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Osmosis: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Aptos: {
      CoreBridge: "0x5bc11445584a763c1fa7ed39081f1b920954da14e04b32440cba863d03e19625",
      TokenBridge:
        "0x576410486a2da45eee6c949c995670112ddf2fbeedab20350d506328eefc9d4f",
      NftBridge:
        "0x1bdffae984043833ed7fe223f7af7a3f8902d04129b14f801823e64827da7130",
      Relayer: undefined,
    },
    Sui: {
      CoreBridge: "0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c",
      TokenBridge:
        "0xc57508ee0d4595e5a8728974a4a93a787d38f339757230d441e895422c07aba9",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Moonbeam: {
      CoreBridge: "0xC8e2b0cD52Cf01b0Ce87d389Daa3d414d4cE29f3",
      TokenBridge: "0xb1731c586ca89a23809861c6103f0b96b3f57d92",
      NftBridge: "0x453cfbe096c0f8d763e8c5f24b441097d577bde2",
      Relayer: undefined,
    },
    Neon: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Terra2: {
      CoreBridge: "terra12mrnzvhx3rpej6843uge2yyfppfyd3u9c3uq223q8sl48huz9juqffcnhp",
      TokenBridge:
        "terra153366q50k7t8nn7gec00hg66crnhkdggpgdtaxltaq6xrutkkz3s992fw9",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Arbitrum: {
      CoreBridge: "0xa5f208e072434bC67592E4C49C1B991BA79BCA46",
      TokenBridge: "0x0b2402144Bb366A632D14B83F244D2e0e21bD39c",
      NftBridge: "0x3dD14D553cFD986EAC8e3bddF629d82073e188c8",
      Relayer: undefined,
    },
    Optimism: {
      CoreBridge: "0xEe91C335eab126dF5fDB3797EA9d6aD93aeC9722",
      TokenBridge: "0x1D68124e65faFC907325e3EDbF8c4d84499DAa8b",
      NftBridge: "0xfE8cD454b4A1CA468B57D79c0cc77Ef5B6f64585",
      Relayer: undefined,
    },
    Gnosis: {
      CoreBridge: "0xa321448d90d4e5b0A732867c18eA198e75CAC48E",
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Pythnet: {
      CoreBridge: "H3fxXJ86ADW2PNuDDmZJg6mzTtPxkYCpNuQUTgmJ7AjU",
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Xpla: {
      CoreBridge: "xpla1jn8qmdda5m6f6fqu9qv46rt7ajhklg40ukpqchkejcvy8x7w26cqxamv3w",
      TokenBridge:
        "xpla137w0wfch2dfmz7jl2ap8pcmswasj8kg06ay4dtjzw7tzkn77ufxqfw7acv",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Btc: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Base: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Sei: {
      CoreBridge: "sei1gjrrme22cyha4ht2xapn3f08zzw6z3d4uxx6fyy9zd5dyr3yxgzqqncdqn",
      TokenBridge:
        "sei1smzlm9t79kur392nu9egl8p8je9j92q4gzguewj56a05kyxxra0qy0nuf3",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Wormchain: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Sepolia: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
  },
  "Testnet": {
    Solana: {
      CoreBridge: "3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5",
      TokenBridge: "DZnkkTmCiFWfYTfT41X3Rd1kDgozqzxWaHqsw6W4x2oe",
      NftBridge: "2rHhojZ7hpu1zA91nvZmT8TqWWvMcKmmNBCr2mKTtMq4",
      Relayer: undefined,
    },
    Ethereum: {
      CoreBridge: "0x706abc4E45D419950511e474C7B9Ed348A4a716c",
      TokenBridge: "0xF890982f9310df57d00f659cf4fd87e65adEd8d7",
      NftBridge: "0xD8E4C2DbDd2e2bd8F1336EA691dBFF6952B1a6eB",
      Relayer: undefined,
    },
    Terra: {
      CoreBridge: "terra1pd65m0q9tl3v8znnz5f5ltsfegyzah7g42cx5v",
      TokenBridge: "terra1pseddrv0yfsn76u4zxrjmtf45kdlmalswdv39a",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Bsc: {
      CoreBridge: "0x68605AD7b15c732a30b1BbC62BE8F2A509D74b4D",
      TokenBridge: "0x9dcF9D205C9De35334D646BeE44b2D2859712A09",
      NftBridge: "0xcD16E5613EF35599dc82B24Cb45B5A93D779f1EE",
      Relayer: undefined,
    },
    Polygon: {
      CoreBridge: "0x0CBE91CF822c73C2315FB05100C2F714765d5c20",
      TokenBridge: "0x377D55a7928c046E18eEbb61977e714d2a76472a",
      NftBridge: "0x51a02d0dcb5e52F5b92bdAA38FA013C91c7309A9",
      Relayer: undefined,
    },
    Avalanche: {
      CoreBridge: "0x7bbcE28e64B3F8b84d876Ab298393c38ad7aac4C",
      TokenBridge: "0x61E44E506Ca5659E6c0bba9b678586fA2d729756",
      NftBridge: "0xD601BAf2EEE3C028344471684F6b27E789D9075D",
      Relayer: undefined,
    },
    Oasis: {
      CoreBridge: "0xc1C338397ffA53a2Eb12A7038b4eeb34791F8aCb",
      TokenBridge: "0x88d8004A9BdbfD9D28090A02010C19897a29605c",
      NftBridge: "0xC5c25B41AB0b797571620F5204Afa116A44c0ebA",
      Relayer: undefined,
    },
    Algorand: {
      CoreBridge: "86525623",
      TokenBridge: "86525641",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Aurora: {
      CoreBridge: "0xBd07292de7b505a4E803CEe286184f7Acf908F5e",
      TokenBridge: "0xD05eD3ad637b890D68a854d607eEAF11aF456fba",
      NftBridge: "0x8F399607E9BA2405D87F5f3e1B78D950b44b2e24",
      Relayer: undefined,
    },
    Fantom: {
      CoreBridge: "0x1BB3B4119b7BA9dfad76B0545fb3F531383c3bB7",
      TokenBridge: "0x599CEa2204B4FaECd584Ab1F2b6aCA137a0afbE8",
      NftBridge: "0x63eD9318628D26BdCB15df58B53BB27231D1B227",
      Relayer: undefined,
    },
    Karura: {
      CoreBridge: "0xE4eacc10990ba3308DdCC72d985f2a27D20c7d03",
      TokenBridge: "0xd11De1f930eA1F7Dd0290Fe3a2e35b9C91AEFb37",
      NftBridge: "0x0A693c2D594292B6Eb89Cb50EFe4B0b63Dd2760D",
      Relayer: undefined,
    },
    Acala: {
      CoreBridge: "0x4377B49d559c0a9466477195C6AdC3D433e265c0",
      TokenBridge: "0xebA00cbe08992EdD08ed7793E07ad6063c807004",
      NftBridge: "0x96f1335e0AcAB3cfd9899B30b2374e25a2148a6E",
      Relayer: undefined,
    },
    Klaytn: {
      CoreBridge: "0x1830CC6eE66c84D2F177B94D544967c774E624cA",
      TokenBridge: "0xC7A13BE098720840dEa132D860fDfa030884b09A",
      NftBridge: "0x94c994fC51c13101062958b567e743f1a04432dE",
      Relayer: undefined,
    },
    Celo: {
      CoreBridge: "0x88505117CA88e7dd2eC6EA1E13f0948db2D50D56",
      TokenBridge: "0x05ca6037eC51F8b712eD2E6Fa72219FEaE74E153",
      NftBridge: "0xaCD8190F647a31E56A656748bC30F69259f245Db",
      Relayer: undefined,
    },
    Near: {
      CoreBridge: "wormhole.wormhole.Testnet",
      TokenBridge: "token.wormhole.Testnet",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Injective: {
      CoreBridge: "inj1xx3aupmgv3ce537c0yce8zzd3sz567syuyedpg",
      TokenBridge: "inj1q0e70vhrv063eah90mu97sazhywmeegp7myvnh",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Osmosis: {
      CoreBridge: "osmo1hggkxr0hpw83f8vuft7ruvmmamsxmwk2hzz6nytdkzyup9krt0dq27sgyx",
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Aptos: {
      CoreBridge: "0x5bc11445584a763c1fa7ed39081f1b920954da14e04b32440cba863d03e19625",
      TokenBridge:
        "0x576410486a2da45eee6c949c995670112ddf2fbeedab20350d506328eefc9d4f",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Sui: {
      CoreBridge: "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790",
      TokenBridge:
        "0x6fb10cdb7aa299e9a4308752dadecb049ff55a892de92992a1edbd7912b3d6da",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Moonbeam: {
      CoreBridge: "0xa5B7D85a8f27dd7907dc8FdC21FA5657D5E2F901",
      TokenBridge: "0xbc976D4b9D57E57c3cA52e1Fd136C45FF7955A96",
      NftBridge: "0x98A0F4B96972b32Fcb3BD03cAeB66A44a6aB9Edb",
      Relayer: undefined,
    },
    Neon: {
      CoreBridge: "0x268557122Ffd64c85750d630b716471118F323c8",
      TokenBridge: "0xEe3dB83916Ccdc3593b734F7F2d16D630F39F1D0",
      NftBridge: "0x66E5BcFD45D2F3f166c567ADa663f9d2ffb292B4",
      Relayer: undefined,
    },
    Terra2: {
      CoreBridge: "terra19nv3xr5lrmmr7egvrk2kqgw4kcn43xrtd5g0mpgwwvhetusk4k7s66jyv0",
      TokenBridge:
        "terra1c02vds4uhgtrmcw7ldlg75zumdqxr8hwf7npseuf2h58jzhpgjxsgmwkvk",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Arbitrum: {
      CoreBridge: "0xC7A204bDBFe983FCD8d8E61D02b475D4073fF97e",
      TokenBridge: "0x23908A62110e21C04F3A4e011d24F901F911744A",
      NftBridge: "0xEe3dB83916Ccdc3593b734F7F2d16D630F39F1D0",
      Relayer: undefined,
    },
    Optimism: {
      CoreBridge: "0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35",
      TokenBridge: "0xC7A204bDBFe983FCD8d8E61D02b475D4073fF97e",
      NftBridge: "0x23908A62110e21C04F3A4e011d24F901F911744A",
      Relayer: undefined,
    },
    Gnosis: {
      CoreBridge: "0xE4eacc10990ba3308DdCC72d985f2a27D20c7d03",
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Pythnet: {
      CoreBridge: "EUrRARh92Cdc54xrDn6qzaqjA77NRrCcfbr8kPwoTL4z",
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Xpla: {
      CoreBridge: "xpla1upkjn4mthr0047kahvn0llqx4qpqfn75lnph4jpxfn8walmm8mqsanyy35",
      TokenBridge:
        "xpla1kek6zgdaxcsu35nqfsyvs2t9vs87dqkkq6hjdgczacysjn67vt8sern93x",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Btc: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Base: {
      CoreBridge: "0x23908A62110e21C04F3A4e011d24F901F911744A",
      TokenBridge: "0xA31aa3FDb7aF7Db93d18DDA4e19F811342EDF780",
      NftBridge: "0xF681d1cc5F25a3694E348e7975d7564Aa581db59",
      Relayer: undefined,
    },
    Sei: {
      CoreBridge: "sei1nna9mzp274djrgzhzkac2gvm3j27l402s4xzr08chq57pjsupqnqaj0d5s",
      TokenBridge:
        "sei1jv5xw094mclanxt5emammy875qelf3v62u4tl4lp5nhte3w3s9ts9w9az2",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Wormchain: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Sepolia: {
      CoreBridge: "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78",
      TokenBridge: "0xDB5492265f6038831E89f495670FF909aDe94bd9",
      NftBridge: "0x6a0B52ac198e4870e5F3797d5B403838a5bbFD99",
      Relayer: undefined,
    },
  },
  "Devnet": {
    Solana: {
      CoreBridge: "Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o",
      TokenBridge: "B6RHG3mfcckmrYN1UhmJzyS1XX3fZKbkeUcpJe9Sy3FE",
      NftBridge: "NFTWqJR8YnRVqPDvTJrYuLrQDitTG5AScqbeghi4zSA",
      Relayer: undefined,
    },
    Ethereum: {
      CoreBridge: "0xC89Ce4735882C9F0f0FE26686c53074E09B0D550",
      TokenBridge: "0x0290FB167208Af455bB137780163b7B7a9a10C16",
      NftBridge: "0x26b4afb60d6c903165150c6f0aa14f8016be4aec",
      Relayer: undefined,
    },
    Terra: {
      CoreBridge: "terra18vd8fpwxzck93qlwghaj6arh4p7c5n896xzem5",
      TokenBridge: "terra10pyejy66429refv3g35g2t7am0was7ya7kz2a4",
      NftBridge: "terra1plju286nnfj3z54wgcggd4enwaa9fgf5kgrgzl",
      Relayer: undefined,
    },
    Bsc: {
      CoreBridge: "0xC89Ce4735882C9F0f0FE26686c53074E09B0D550",
      TokenBridge: "0x0290FB167208Af455bB137780163b7B7a9a10C16",
      NftBridge: "0x26b4afb60d6c903165150c6f0aa14f8016be4aec",
      Relayer: undefined,
    },
    Polygon: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Avalanche: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Oasis: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Algorand: {
      CoreBridge: "4",
      TokenBridge: "6",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Aurora: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Fantom: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Karura: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Acala: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Klaytn: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Celo: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Near: {
      CoreBridge: "wormhole.test.near",
      TokenBridge: "token.test.near",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Injective: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Osmosis: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Aptos: {
      CoreBridge: "0xde0036a9600559e295d5f6802ef6f3f802f510366e0c23912b0655d972166017",
      TokenBridge:
        "0x84a5f374d29fc77e370014dce4fd6a55b58ad608de8074b0be5571701724da31",
      NftBridge:
        "0x46da3d4c569388af61f951bdd1153f4c875f90c2991f6b2d0a38e2161a40852c",
      Relayer: undefined,
    },
    Sui: {
      CoreBridge: "0x5a5160ca3c2037f4b4051344096ef7a48ebf4400b3f385e57ea90e1628a8bde0", // wormhole module State object ID
      TokenBridge:
        "0xa6a3da85bbe05da5bfd953708d56f1a3a023e7fb58e5a824a3d4de3791e8f690", // token_bridge module State object ID
      NftBridge: undefined,
      Relayer: undefined,
    },
    Moonbeam: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Neon: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Terra2: {
      CoreBridge: "terra14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9ssrc8au",
      TokenBridge:
        "terra1nc5tatafv6eyq7llkr2gv50ff9e22mnf70qgjlv737ktmt4eswrquka9l6",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Arbitrum: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Optimism: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Gnosis: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Pythnet: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Xpla: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Btc: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Base: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Sei: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
    Wormchain: {
      CoreBridge: "wormhole1ap5vgur5zlgys8whugfegnn43emka567dtq0jl",
      TokenBridge: "wormhole1zugu6cajc4z7ue29g9wnes9a5ep9cs7yu7rn3z",
      NftBridge: undefined,
      Relayer: undefined,
    },
    Sepolia: {
      CoreBridge: undefined,
      TokenBridge: undefined,
      NftBridge: undefined,
      Relayer: undefined,
    },
  },
} as const satisfies Record<Network, Record<Chain, Record<Module, string | undefined>>>;
