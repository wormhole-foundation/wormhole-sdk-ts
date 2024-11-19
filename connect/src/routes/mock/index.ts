import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import type {
  ChainAddress,
  ChainContext,
  Signer,
  TokenId,
} from "@wormhole-foundation/sdk-definitions";
import { nativeTokenId } from "@wormhole-foundation/sdk-definitions";
import type { StaticRouteMethods } from "../route.js";
import { AutomaticRoute } from "../route.js";
import type {
  Quote,
  Receipt,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types.js";
import type { RouteTransferRequest } from "../request.js";
import { chains } from "@wormhole-foundation/sdk-base";

export namespace AutomaticMockRoute {
  export type Options = {
    // Expressed in percentage terms
    // e.g. 1.0 = 100%
    nativeGas: number;
  };

  export type NormalizedParams = {};

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = AutomaticMockRoute.Options;
type Vp = AutomaticMockRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;
type R = Receipt;
type Q = Quote<Op, Vp>;

export class AutomaticMockRoute<N extends Network>
  extends AutomaticRoute<N, Op, Vp, R>
  implements StaticRouteMethods<typeof AutomaticMockRoute>
{
  static NATIVE_GAS_DROPOFF_SUPPORTED = true;

  static meta = {
    name: "AutomaticMock",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }

  // get the list of chains this route supports
  static supportedChains(network: Network): Chain[] {
    return chains;
  }

  // get the list of source tokens that are possible to send
  static async supportedSourceTokens(fromChain: ChainContext<Network>): Promise<TokenId[]> {
    return Promise.resolve([nativeTokenId(fromChain.chain)]);
  }

  // get the list of destination tokens that may be received on the destination chain
  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    return Promise.resolve([nativeTokenId(toChain.chain)]);
  }

  static isProtocolSupported<N extends Network>(chain: ChainContext<N>): boolean {
    return true;
  }

  getDefaultOptions(): Op {
    return { nativeGas: 0.0 };
  }

  async isAvailable(request: RouteTransferRequest<N>): Promise<boolean> {
    return Promise.resolve(true);
  }

  async validate(request: RouteTransferRequest<N>, params: Tp): Promise<Vr> {
    const options = params.options ?? this.getDefaultOptions();

    const updatedParams = { ...params, options };
    const validatedParams: Vp = {
      ...updatedParams,
      normalizedParams: { ...updatedParams },
    };

    return Promise.resolve({ valid: true, params: validatedParams });
  }

  async quote(request: RouteTransferRequest<N>, params: Vp): Promise<any> {
    return Promise.resolve({
      success: true,
      sourceToken: {
        token: request.source,
        amount: {
          amount: "1000000",
          decimals: 8,
        },
      },
      destinationToken: {
        token: request.destination,
        amount: {
          amount: "1000000",
          decimals: 8,
        },
      },
      relayFee: {
        token: request.destination,
        amount: {
          amount: "10000",
          decimals: 8,
        },
      },
      warnings: [],
      eta: "120000",
    });
  }

  async initiate(
    request: RouteTransferRequest<N>,
    signer: Signer,
    quote: Q,
    to: ChainAddress,
  ): Promise<R> {
    return {
      from: request.fromChain.chain,
      to: request.toChain.chain,
      state: 1,
      originTxs: [],
    };
  }

  public override async *track(receipt: R, timeout?: number) {
    const trackFunc = async function* () {
      yield {
        ...receipt,
        state: 4,
      };
    };

    yield* trackFunc();
  }
}
