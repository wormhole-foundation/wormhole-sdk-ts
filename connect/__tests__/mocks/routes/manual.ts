import {
  Chain,
  ChainContext,
  CompletedTransferReceipt,
  Network,
  Signer,
  SourceInitiatedTransferReceipt,
  TokenId,
  TransactionId,
  TransferState,
  WormholeMessageId,
  encoding,
  nativeTokenId,
  amount,
} from "../../../src";
import { ManualRoute, RouteTransferRequest, StaticRouteMethods } from "../../../src/routes/route";
import {
  Quote,
  Receipt,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../../../src/routes/types";

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Op = {};
type R = Receipt;
type Q = Quote<Op>;
type Vp = ValidatedTransferParams<Op>;

export class ManualMockRoute<N extends Network>
  extends ManualRoute<N, Op, Vp, R>
  implements StaticRouteMethods<typeof ManualMockRoute>
{
  static meta = {
    name: "ManualFauxBridge",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }
  static supportedChains(network: Network): Chain[] {
    return ["Solana", "Ethereum"];
  }
  static async supportedSourceTokens(fromChain: ChainContext<Network>): Promise<TokenId[]> {
    await delay(250);
    return [nativeTokenId(fromChain.chain)];
  }
  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    await delay(250);
    return [nativeTokenId(toChain.chain)];
  }

  async validate(
    request: RouteTransferRequest<N>,
    params: TransferParams<Op>,
  ): Promise<ValidationResult<Op>> {
    await delay(250);
    return {
      valid: true,
      params: { ...params, options: this.getDefaultOptions() },
    };
  }

  async quote(request: RouteTransferRequest<N>, params: ValidatedTransferParams<Op>): Promise<Q> {
    await delay(1000);
    const fakeQuote: Q = {
      success: true,
      sourceToken: {
        token: request.source.id,
        amount: amount.parse(params.amount, request.destination.decimals),
      },
      destinationToken: {
        token: request.destination!.id,
        amount: amount.parse(params.amount, request.destination.decimals),
      },
      relayFee: {
        token: request.source.id,
        amount: amount.parse("0.01", request.source.decimals),
      },
      params,
    };
    return fakeQuote;
  }

  async initiate(request: RouteTransferRequest<N>, sender: Signer, _quote: Q): Promise<R> {
    await delay(1000);

    const fakeTxId =
      request.from.chain === "Solana"
        ? encoding.b58.encode(new Uint8Array(64))
        : encoding.hex.encode(new Uint8Array(32));

    const fakeReceipt: SourceInitiatedTransferReceipt = {
      from: request.from.chain,
      to: request.to.chain,
      state: TransferState.SourceInitiated,
      originTxs: [{ chain: sender.chain(), txid: fakeTxId }],
    };

    return fakeReceipt;
  }

  async *track(receipt: R, timeout?: number | undefined): AsyncGenerator<R> {
    await delay(1000);
    const fakeReceipt = {
      ...(receipt as SourceInitiatedTransferReceipt),
      state: TransferState.DestinationInitiated,
      attestation: {
        id: {} as WormholeMessageId,
      },
    } satisfies CompletedTransferReceipt<unknown, typeof receipt.from, typeof receipt.to>;
    yield fakeReceipt;
  }

  async complete(sender: Signer, receipt: R): Promise<TransactionId[]> {
    return [];
  }

  getDefaultOptions() {
    return {};
  }
}
