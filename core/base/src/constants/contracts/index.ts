import * as core from './core.js';
import * as tb from './tokenBridge.js';
import * as tbr from './tokenBridgeRelayer.js';
import * as nb from './nftBridge.js';
import * as r from './relayer.js';
import * as circle from './circle.js';
import * as g from './cosmos.js';
import * as rollup from './rollupCheckpoint.js';
import * as p from './portico.js';

import { constMap } from './../../utils/index.js';

export const coreBridge = constMap(core.coreBridgeContracts);
export const tokenBridge = constMap(tb.tokenBridgeContracts);
export const tokenBridgeRelayer = constMap(tbr.tokenBridgeRelayerContracts);
export const nftBridge = constMap(nb.nftBridgeContracts);
export const relayer = constMap(r.relayerContracts);
export const gateway = constMap(g.gatewayContracts);
export const translator = constMap(g.translatorContracts);
export const portico = constMap(p.porticoContracts);

export type { CircleContracts } from './circle.js';
export const circleContracts = constMap(circle.circleContracts);

export type { PorticoContracts } from './portico.js';
export const rollupContracts = constMap(rollup.rollupContractAddresses);

// @ts-ignore: Adding one more token bridge is causing "Type instantiation is excessively deep and possibly infinite."
export const tokenBridgeChains = constMap(tb.tokenBridgeContracts, [0, 1]);
export const tokenBridgeRelayerChains = constMap(tbr.tokenBridgeRelayerContracts, [0, 1]);
export const circleContractChains = constMap(circle.circleContracts, [0, 1]);
export const porticoContractChains = constMap(p.porticoContracts, [0, 1]);
