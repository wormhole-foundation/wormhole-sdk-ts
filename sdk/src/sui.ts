import { PlatformDefinition } from "./index.js";
const sui = async (): Promise<PlatformDefinition<"Sui">> =>
  (await import("./platforms/sui.js")).default;
export default sui;
