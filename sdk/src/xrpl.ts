/// <reference path="../../platforms/xrpl/src/index.ts" />
import type { PlatformDefinition } from "./index.js";
const xrpl = async (): Promise<PlatformDefinition<"Xrpl">> =>
  (await import("./platforms/xrpl.js")).default;
export default xrpl;
