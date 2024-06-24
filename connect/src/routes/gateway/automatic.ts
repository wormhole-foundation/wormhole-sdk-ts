import { AutomaticRoute, type StaticRouteMethods } from "../route.js";
import { chains, chainToPlatform, type Chain, type Network } from "@wormhole-foundation/sdk-base";
import type {
  ChainAddress,
  ChainContext,
  GatewayTransferDetails,
  Signer,
  TokenId,
} from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../../wormhole.js";
import type {
  Quote,
  QuoteResult,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types.js";
import { GatewayTransfer } from "../../protocols/index.js";
import { amount } from "@wormhole-foundation/sdk-base";
import {
  TransferState,
  type SourceInitiatedTransferReceipt,
  type TransferReceipt,
} from "../../types.js";
import { isNative } from "@wormhole-foundation/sdk-definitions";
import { contracts } from "@wormhole-foundation/sdk-base";
import { networkChainToChannels } from "../../../../platforms/cosmwasm/src/constants.js";
import { isChain } from "@wormhole-foundation/sdk-base";

export namespace GatewayRoute {
  export type Options = {};

  export type NormalizedParams = {
    amount: amount.Amount;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = GatewayRoute.Options;
type Vp = GatewayRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type QR = QuoteResult<Op, Vp>;
type Q = Quote<Op, Vp>;
type R = TransferReceipt<GatewayTransfer.AttestationReceipt>;

export class AutomaticGatewayRoute<N extends Network>
  extends AutomaticRoute<N, Op, Vp, R>
  implements StaticRouteMethods<typeof AutomaticGatewayRoute>
{
  NATIVE_GAS_DROPOFF_SUPPORTED = false;

  static meta = {
    name: "AutomaticGateway",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }

  static supportedChains(network: Network): Chain[] {
    const supported = new Set<Chain>();
    // Chains with token bridge are supported
    contracts.tokenBridgeChains(network).forEach((chain) => supported.add(chain));
    // Chains connected to Gateway are supported
    Object.entries(networkChainToChannels(network, GatewayTransfer.chain)).forEach(
      ([chainName]) => {
        if (isChain(chainName)) {
          supported.add(chainName);
        }
      },
    );
    return [...supported];
  }

  static async supportedSourceTokens(fromChain: ChainContext<Network>): Promise<TokenId[]> {
    let isGatewayEnabled = false;
    if (chainToPlatform(fromChain.chain) === "Cosmwasm") {
      const gw = await fromChain.platform.getChain(GatewayTransfer.chain);
      isGatewayEnabled = await GatewayTransfer.isGatewayEnabled(fromChain.chain, gw);
    }
    return (
      Object.values(fromChain.config.tokenMap!)
        .map((td) => Wormhole.tokenId(td.chain, td.address))
        // Native tokens sent from Cosmos chains is not supported
        .filter((t) => !isGatewayEnabled || !isNative(t.address))
    );
  }

  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    const gateway = (
      chainToPlatform(fromChain.chain) === "Cosmwasm" ? fromChain.platform : toChain.platform
    ).getChain(GatewayTransfer.chain);
    try {
      return [
        await GatewayTransfer.lookupDestinationToken(fromChain, toChain, gateway, sourceToken),
      ];
    } catch (e) {
      console.error(`Failed to get destination token: ${e}`);
      return [];
    }
  }

  static isProtocolSupported<N extends Network>(chain: ChainContext<N>): boolean {
    return chain.supportsTokenBridge() || chain.supportsIbcBridge();
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getDefaultOptions(): Op {
    return {};
  }

  async validate(params: Tp): Promise<Vr> {
    const validatedParams: Vp = {
      amount: params.amount,
      normalizedParams: { amount: amount.parse(params.amount, this.request.source.decimals) },
      options: {},
    };
    return { valid: true, params: validatedParams };
  }

  async quote(params: Vp): Promise<QR> {
    try {
      return this.request.displayQuote(
        await GatewayTransfer.quoteTransfer(this.wh, this.request.fromChain, this.request.toChain, {
          token: this.request.source.id,
          amount: amount.units(params.normalizedParams.amount),
          ...params.options,
        }),
        params,
      );
    } catch (e) {
      return {
        success: false,
        error: e as Error,
      };
    }
  }

  async initiate(signer: Signer, quote: Q, to: ChainAddress): Promise<R> {
    const transfer = await GatewayTransfer.destinationOverrides(
      this.request.fromChain,
      this.request.toChain,
      this.wh.getChain(GatewayTransfer.chain),
      this.toTransferDetails(
        quote.params,
        Wormhole.chainAddress(signer.chain(), signer.address()),
        to,
      ),
    );
    const txids = await GatewayTransfer.transfer<N>(
      this.wh,
      this.request.fromChain,
      transfer,
      signer,
    );
    return {
      from: transfer.from.chain,
      to: transfer.to.chain,
      state: TransferState.SourceInitiated,
      originTxs: txids,
    } satisfies SourceInitiatedTransferReceipt;
  }

  public override async *track(receipt: R, timeout?: number) {
    yield* GatewayTransfer.track(
      this.wh,
      receipt,
      timeout,
      this.request.fromChain,
      this.request.toChain,
    );
  }

  private toTransferDetails(
    params: Vp,
    from: ChainAddress,
    to: ChainAddress,
  ): GatewayTransferDetails {
    return {
      from,
      to,
      token: this.request.source.id,
      amount: amount.units(params.normalizedParams.amount),
      ...params.options,
    };
  }
}
