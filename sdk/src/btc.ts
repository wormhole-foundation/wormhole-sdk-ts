/// <reference path="../../platforms/btc/src/index.ts" />
import type { PlatformDefinition } from "./index.js";
const btc = async (): Promise<PlatformDefinition<"Btc">> =>
  (await import("./platforms/btc.js")).default;
export default btc;
