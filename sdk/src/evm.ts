/// <reference path="../../platforms/evm/src/index.ts" />
import type { PlatformDefinition } from "./index.js";
const evm = async (): Promise<PlatformDefinition<"Evm">> =>
  (await import("./platforms/evm.js")).default;
export default evm;
