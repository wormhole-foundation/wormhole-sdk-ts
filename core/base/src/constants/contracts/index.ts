import * as core from "./core";
import * as tb from "./tokenBridge";
import * as tbr from "./tokenBridgeRelayer";
import * as nb from "./nftBridge";
import * as r from "./relayer";
import * as circle from "./circle";
import * as g from "./cosmos";
import * as rollup from "./rollupCheckpoint";
import * as p from "./portico";

import { constMap } from "../../utils";

export const coreBridge = constMap(core.coreBridgeContracts);
export const tokenBridge = constMap(tb.tokenBridgeContracts);
export const tokenBridgeRelayer = constMap(tbr.tokenBridgeRelayerContracts);
export const nftBridge = constMap(nb.nftBridgeContracts);
export const relayer = constMap(r.relayerContracts);
export const gateway = constMap(g.gatewayContracts);
export const translator = constMap(g.translatorContracts);
export const portico = constMap(p.porticoContracts);

export { CircleContracts } from "./circle";
export const circleContracts = constMap(circle.circleContracts);

export { PorticoContracts } from "./portico";
export const rollupContracts = constMap(rollup.rollupContractAddresses);

export const tokenBridgeChains = constMap(tb.tokenBridgeContracts, [0, 1]);
export const tokenBridgeRelayerChains = constMap(tbr.tokenBridgeRelayerContracts, [0, 1]);
export const circleContractChains = constMap(circle.circleContracts, [0, 1]);
export const porticoContractChains = constMap(p.porticoContracts, [0, 1]);
