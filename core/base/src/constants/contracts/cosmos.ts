import type { MapLevels } from './../../utils/index.js';
import type { Network } from '../networks.js';
import type { Chain } from '../chains.js';

// prettier-ignore
export const gatewayContracts = [[
  "Mainnet", [
    ["Wormchain", "wormhole14ejqjyq8um4p3xfqj74yld5waqljf88fz25yxnma0cngspxe3les00fpjx"]
  ]], [
  "Testnet", [
    ["Wormchain", "wormhole1ctnjk7an90lz5wjfvr3cf6x984a8cjnv8dpmztmlpcq4xteaa2xs9pwmzk"]
  ]],
] as const satisfies MapLevels<[Network, Chain, string]>;

// prettier-ignore
export const translatorContracts = [[
  "Mainnet", [
    ["Sei", "sei189adguawugk3e55zn63z8r9ll29xrjwca636ra7v7gxuzn98sxyqwzt47l"],
  ]], [
  "Testnet", [
    ["Sei", "sei1dkdwdvknx0qav5cp5kw68mkn3r99m3svkyjfvkztwh97dv2lm0ksj6xrak"]
  ]],
] as const satisfies MapLevels<[Network, Chain, string]>;
