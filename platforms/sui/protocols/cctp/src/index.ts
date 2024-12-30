import { registerProtocol } from "@wormhole-foundation/sdk-connect";

import { SuiCircleBridge } from "./circleBridge.js";

registerProtocol("Sui", "CircleBridge", SuiCircleBridge);
export * from "./circleBridge.js";
