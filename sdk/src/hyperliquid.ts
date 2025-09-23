/// <reference path="../../platforms/hyperliquid/src/index.ts" />
import type { PlatformDefinition } from "./index.js";
const hyperliquid = async (): Promise<PlatformDefinition<"Hyperliquid">> =>
  (await import("./platforms/hyperliquid.js")).default;
export default hyperliquid;
