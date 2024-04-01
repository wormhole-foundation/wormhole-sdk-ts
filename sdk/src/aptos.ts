import { PlatformDefinition } from "./index.js";
const aptos = async (): Promise<PlatformDefinition<"Aptos">> =>
  (await import("./platforms/aptos.js")).default;
export default aptos;
