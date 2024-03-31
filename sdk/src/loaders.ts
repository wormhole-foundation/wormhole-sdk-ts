import {
  NativeAddressCtr,
  Platform,
  PlatformUtils,
  RpcConnection,
  Signer,
} from "@wormhole-foundation/sdk-connect";

export interface PlatformDefinition<P extends Platform> {
  Platform: PlatformUtils<P>;
  Address: NativeAddressCtr;
  getSigner: (rpc: RpcConnection<P>, key: string, ...args: any) => Promise<Signer>;
  protocolLoaders: {
    [key: string]: () => Promise<any>;
  };
}

export type PlatformLoader<P extends Platform> = () => Promise<PlatformDefinition<P>>;

const sui = async () => (await import("./sui.js")).default;
const solana = async () => (await import("./solana.js")).default;
const algorand = async () => (await import("./algorand.js")).default;
const evm = async () => (await import("./evm.js")).default;
const cosmwasm = async () => (await import("./cosmwasm.js")).default;
const aptos = async () => (await import("./aptos.js")).default;

export { algorand, aptos, cosmwasm, evm, solana, sui };
