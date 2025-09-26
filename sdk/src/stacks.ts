/// <reference path="../../platforms/stacks/src/index.ts" />
import type { PlatformDefinition } from "./index.js";
const stacks = async (): Promise<PlatformDefinition<"Stacks">> => 
  (await import("./platforms/stacks.js")).default;
export default stacks;

