/// <reference path="../../platforms/cosmwasm/src/index.ts" />
import { PlatformDefinition } from "./index.js";
const cosmwasm = async (): Promise<PlatformDefinition<"Cosmwasm">> =>
  (await import("./platforms/cosmwasm.js")).default;
export default cosmwasm;
