import {
  chains,
  toChainId,
  chainToChainId,
  chainIdToChain,
  CustomConversion,
  FixedConversion,
  UintLayoutItem,
  Chain,
} from "@wormhole-foundation/sdk-base";

const chainItemBase = { binary: "uint", size: 2 } as const;

type AllowNull<T, B extends boolean> = B extends true ? T | null : T;

export const chainItem = <
  C extends readonly Chain[] = typeof chains,
  N extends boolean = false
>(opts?: {
  allowedChains?: C;
  allowNull?: N;
}) =>
  ({
    ...chainItemBase,
    custom: {
      to: (val: number): AllowNull<C[number], N> => {
        if (val === 0) {
          if (!opts?.allowNull)
            throw new Error(
              "ChainId 0 is not valid for this protocol and action"
            );

          return null as AllowNull<C[number], N>;
        }

        const chain = chainIdToChain(toChainId(val));
        const allowedChains = opts?.allowedChains ?? chains;
        if (!allowedChains.includes(chain))
          throw new Error(
            `Chain ${chain} not in allowed chains ${allowedChains}`
          );

        return chain;
      },
      from: (val: AllowNull<C[number], N>): number =>
        val == null ? 0 : chainToChainId(val),
    } satisfies CustomConversion<number, AllowNull<C[number], N>>,
  } as const satisfies UintLayoutItem);

export const fixedChainItem = <C extends Chain>(chain: C) =>
  ({
    ...chainItemBase,
    custom: {
      to: chain,
      from: chainToChainId(chain),
    } satisfies FixedConversion<number, C>,
  } as const satisfies UintLayoutItem);
