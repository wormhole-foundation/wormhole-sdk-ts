import { ChainContext, Platform } from "@wormhole-foundation/connect-sdk";
import { CosmwasmPlatform } from "./platform";

export class CosmwasmChain extends ChainContext<"Cosmwasm"> {
  readonly platform: Platform<"Cosmwasm"> = CosmwasmPlatform;
}
