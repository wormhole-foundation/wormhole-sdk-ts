import * as core from "./core";
import * as tb from "./tokenBridge";
import * as nb from "./nftBridge";
import * as r from "./relayer";
import * as circle from "./circle";

import { constMap } from "../../utils";

export const coreBridge = constMap(core.coreBridgeContracts);
export const tokenBridge = constMap(tb.tokenBridgeContracts);
export const nftBridge = constMap(nb.nftBridgeContracts);
export const relayer = constMap(r.relayerContracts);

export { CircleContracts } from "./circle";
export const circleContracts = constMap(circle.circleContracts);
