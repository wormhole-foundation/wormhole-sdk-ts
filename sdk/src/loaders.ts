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

export const loaders = {
  Algorand: algorand,
  Aptos: aptos,
  Cosmwasm: cosmwasm,
  Evm: evm,
  Solana: solana,
  Sui: sui,
};

export function load(...platforms: Platform[]): PlatformLoader<Platform>[] {
  // no platforms specified, load all
  if (!platforms) platforms = Object.keys(loaders) as Platform[];

  // return all specified platform loaders
  return platforms.map((platform) => {
    switch (platform) {
      case "Algorand":
        return algorand;
      case "Aptos":
        return aptos;
      case "Cosmwasm":
        return cosmwasm;
      case "Evm":
        return evm;
      case "Solana":
        return solana;
      case "Sui":
        return sui;
    }
  }) as PlatformLoader<Platform>[];
}
