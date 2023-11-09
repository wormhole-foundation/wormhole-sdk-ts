import { ChainContext, Platform } from "@wormhole-foundation/connect-sdk";
import { AptosPlatform } from "./platform";

export class AptosChain extends ChainContext<"Aptos"> {
  readonly platform: Platform<"Aptos"> = AptosPlatform;
}
