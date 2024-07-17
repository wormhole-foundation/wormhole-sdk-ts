/// <reference path="../../platforms/algorand/src/index.ts" />
import type { PlatformDefinition } from "./index.js";
const algorand = async (): Promise<PlatformDefinition<"Algorand">> =>
  (await import("./platforms/algorand.js")).default;
export default algorand;
