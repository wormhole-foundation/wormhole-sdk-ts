"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEthSigner = exports.getSolSigner = void 0;
const bs58_1 = __importDefault(require("bs58"));
const ethers_1 = require("ethers");
const web3_js_1 = require("@solana/web3.js");
// read in from `.env`
require("dotenv").config();
// TODO: err msg instructing dev to `cp .env.template .env` and set values
function getSolSigner() {
    const pk = process.env.SOL_PRIVATE_KEY;
    return web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(pk));
}
exports.getSolSigner = getSolSigner;
function getEthSigner(provider) {
    const pk = process.env.ETH_PRIVATE_KEY;
    return new ethers_1.ethers.Wallet(pk, provider);
}
exports.getEthSigner = getEthSigner;
//# sourceMappingURL=helpers.js.map