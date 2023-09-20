import {
  ChainContext,
  ChainConfig,
  Platform,
  RpcConnection,
  ChainName,
} from "@wormhole-foundation/connect-sdk";

export class CosmwasmChain extends ChainContext<"Cosmwasm"> {
  readonly chain: ChainName;
  readonly platform: Platform<"Cosmwasm">;
  readonly conf: ChainConfig;

  // Cached objects
  private provider?: RpcConnection<"Cosmwasm">;

  constructor(platform: Platform<"Cosmwasm">, chain: ChainName) {
    super(platform, chain);

    this.chain = chain;
    this.conf = platform.conf[chain]!;
    this.platform = platform;
  }

  getRpc(): RpcConnection<"Cosmwasm"> {
    this.provider = this.provider
      ? this.provider
      : this.platform.getRpc(this.chain);

    return this.provider!;
  }
}
