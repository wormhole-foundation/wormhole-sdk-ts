import {
  Chain,
  Network,
  contracts,
  Amount,
  baseUnits,
  amountFromBaseUnits,
  displayAmount,
} from "@wormhole-foundation/sdk-base";
import {
  ChainContext,
  Signer,
  TokenId,
  TokenTransferDetails,
  isNative,
  isTokenId,
  nativeTokenId,
} from "@wormhole-foundation/sdk-definitions";
import { TokenTransfer } from "../../protocols/tokenTransfer";
import { AttestationReceipt, TransferState } from "../../types";
import { AutomaticRoute, StaticRouteMethods } from "../route";
import {
  Quote,
  Receipt,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types";

export namespace AutomaticTokenBridgeRoute {
  export type Options = {
    // Expressed in percentage terms
    // e.g. 1.0 = 100%
    nativeGas: number;
  };

  export type NormalizedParams = {
    fee: Amount;
    amount: Amount;
    nativeGasAmount: Amount;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = AutomaticTokenBridgeRoute.Options;
type Vp = AutomaticTokenBridgeRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;
type Q = Quote;
type R = Receipt<AttestationReceipt<"AutomaticTokenBridge">>;

export class AutomaticTokenBridgeRoute<N extends Network>
  extends AutomaticRoute<N, Op, R, Q>
  implements StaticRouteMethods<typeof AutomaticTokenBridgeRoute>
{
  NATIVE_GAS_DROPOFF_SUPPORTED = true;

  static meta = {
    name: "AutomaticTokenBridge",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }
  // get the list of chains this route supports
  static supportedChains(network: Network): Chain[] {
    if (contracts.tokenBridgeRelayerChains.has(network)) {
      return contracts.tokenBridgeRelayerChains.get(network)!;
    }
    return [];
  }

  // get the list of source tokens that are possible to send
  static async supportedSourceTokens(fromChain: ChainContext<Network>): Promise<TokenId[]> {
    const atb = await fromChain.getAutomaticTokenBridge();
    const registered = await atb.getRegisteredTokens();
    return [
      nativeTokenId(fromChain.chain),
      ...registered.map((v) => {
        return { chain: fromChain.chain, address: v };
      }),
    ];
  }

  // get the liist of destination tokens that may be recieved on the destination chain
  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    return [
      nativeTokenId(toChain.chain),
      await TokenTransfer.lookupDestinationToken(fromChain, toChain, sourceToken),
    ];
  }

  static isProtocolSupported<N extends Network>(chain: ChainContext<N>): boolean {
    return chain.supportsAutomaticTokenBridge();
  }

  getDefaultOptions(): Op {
    return { nativeGas: 0.0 };
  }

  async isAvailable(): Promise<boolean> {
    const atb = await this.request.fromChain.getAutomaticTokenBridge();

    if (isTokenId(this.request.source.id)) {
      return await atb.isRegisteredToken(this.request.source.id.address);
    }

    return true;
  }

  async validate(params: Tp): Promise<Vr> {
    try {
      const options = params.options ?? this.getDefaultOptions();

      const { destination } = this.request;
      let nativeGasPerc = options.nativeGas ?? 0.0;

      if (nativeGasPerc > 1.0 || nativeGasPerc < 0.0)
        throw new Error("Native gas must be between 0.0 and 1.0 (0% and 100%)");

      // If destination is native, max out the nativeGas requested
      if (destination && isNative(destination.id.address) && nativeGasPerc === 0.0)
        nativeGasPerc = 1.0;

      const validatedParams: Vp = {
        amount: params.amount,
        options: { ...params.options, nativeGas: nativeGasPerc },
        normalizedParams: await this.normalizeTransferParams(params),
      };

      return { valid: true, params: validatedParams };
    } catch (e) {
      return { valid: false, params, error: e as Error };
    }
  }

  async normalizeTransferParams(params: Tp): Promise<AutomaticTokenBridgeRoute.NormalizedParams> {
    const amount = this.request.parseAmount(params.amount);

    const inputToken = isNative(this.request.source.id.address)
      ? await this.request.fromChain.getNativeWrappedTokenId()
      : this.request.source.id;

    const atb = await this.request.fromChain.getAutomaticTokenBridge();
    const fee: bigint = await atb.getRelayerFee(
      this.request.from.address,
      this.request.to,
      inputToken.address,
    );

    // Min amount is fee + 5%
    const minAmount = (fee * 105n) / 100n;
    if (baseUnits(amount) < minAmount) {
      throw new Error(
        `Minimum amount is ${displayAmount({
          amount: minAmount.toString(),
          decimals: amount.decimals,
        })}`,
      );
    }

    const transferableAmount = baseUnits(amount) - fee;

    const { destination } = this.request;
    const options = params.options ?? this.getDefaultOptions();

    let nativeGasPerc = options.nativeGas ?? 0.0;
    // If destination is native, max out the nativeGas requested
    if (destination && isNative(destination.id.address) && nativeGasPerc === 0.0)
      nativeGasPerc = 1.0;
    if (nativeGasPerc > 1.0 || nativeGasPerc < 0.0) {
      throw new Error("Native gas must be between 0.0 and 1.0 (0% and 100%)");
    }

    // Determine nativeGas
    let nativeGasAmount = 0n;
    if (nativeGasPerc > 0) {
      // TODO: currently supporting 2 decimals of the percentage requested
      const scale = 10000;
      const scaledGas = BigInt(options.nativeGas * scale);
      nativeGasAmount = (transferableAmount * scaledGas) / BigInt(scale);
    }

    return {
      fee: amountFromBaseUnits(fee, this.request.source.decimals),
      amount,
      nativeGasAmount: amountFromBaseUnits(nativeGasAmount, this.request.source.decimals),
    };
  }

  async quote(params: Vp) {
    return this.request.displayQuote(
      await TokenTransfer.quoteTransfer(
        this.request.fromChain,
        this.request.toChain,
        this.toTransferDetails(params),
      ),
    );
  }

  async initiate(signer: Signer, params: Vp): Promise<R> {
    const transfer = this.toTransferDetails(params);
    const txids = await TokenTransfer.transfer<N>(this.request.fromChain, transfer, signer);
    const msg = await TokenTransfer.getTransferMessage(
      this.request.fromChain,
      txids[txids.length - 1]!.txid,
    );
    return {
      from: transfer.from.chain,
      to: transfer.to.chain,
      state: TransferState.SourceFinalized,
      originTxs: txids,
      attestation: { id: msg },
    };
  }

  public override async *track(receipt: R, timeout?: number) {
    yield* TokenTransfer.track(
      this.wh,
      receipt,
      timeout,
      this.request.fromChain,
      this.request.toChain,
    );
  }

  private toTransferDetails(params: Vp): TokenTransferDetails {
    const transfer = {
      automatic: true,
      from: this.request.from,
      to: this.request.to,
      amount: baseUnits(params.normalizedParams.amount),
      token: this.request.source.id,
      nativeGas: baseUnits(params.normalizedParams.nativeGasAmount),
    };

    return transfer;
  }
}
