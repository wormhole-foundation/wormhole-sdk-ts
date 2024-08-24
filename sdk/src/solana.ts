/// <reference path="../../platforms/solana/src/index.ts" />
import type { PlatformDefinition } from "./index.js";
const solana = async (): Promise<PlatformDefinition<"Solana">> =>
  (await import("./platforms/solana.js")).default;
export default solana;
