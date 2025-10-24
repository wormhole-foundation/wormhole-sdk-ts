import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import { amount, contracts, finality, guardians, time } from "@wormhole-foundation/sdk-base";
import type { StaticRouteMethods } from "../route.js";
import { ManualRoute } from "../route.js";
import type {
  ChainAddress,
  ChainContext,
  Signer,
  TokenId,
  TransactionId,
  WormholeMessageId,
} from "@wormhole-foundation/sdk-definitions";
import {
  deserialize,
  isNative,
  isSameToken,
  serialize,
  TBTCBridge,
} from "@wormhole-foundation/sdk-definitions";
import type {
  Options,
  Quote,
  QuoteResult,
  Receipt,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types.js";
import type { AttestedTransferReceipt, CompletedTransferReceipt } from "../../types.js";
import {
  isAttested,
  isSourceFinalized,
  isSourceInitiated,
  TransferState,
  type AttestationReceipt,
  type SourceInitiatedTransferReceipt,
  type TransferReceipt,
} from "../../types.js";
import type { RouteTransferRequest } from "../request.js";
import { Wormhole } from "../../wormhole.js";
import { signSendWait } from "../../common.js";

export namespace TBTCRoute {
  export type NormalizedParams = {
    amount: amount.Amount;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = Options;
type Vp = TBTCRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type QR = QuoteResult<Op, Vp>;
type Q = Quote<Op, Vp>;
type R = TransferReceipt<AttestationReceipt<"TBTCBridge">>;

export class TBTCRoute<N extends Network>
  extends ManualRoute<N>
  implements StaticRouteMethods<typeof TBTCRoute>
{
  static meta = {
    name: "ManualTBTC",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet"];
  }

  static supportedChains(network: Network): Chain[] {
    return contracts.tokenBridgeChains(network);
  }

  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    if (!(await this.isSourceTokenSupported(sourceToken, fromChain))) {
      return [];
    }

    const tbtcToken = TBTCBridge.getNativeTbtcToken(toChain.chain);
    if (tbtcToken) {
      return [tbtcToken];
    }

    const tb = await toChain.getTokenBridge();
    const ethTbtc = TBTCBridge.getNativeTbtcToken("Ethereum")!;
    try {
      const wrappedTbtc = await tb.getWrappedAsset(ethTbtc);
      return [Wormhole.tokenId(toChain.chain, wrappedTbtc.toString())];
    } catch (e: any) {
      if (e.message.includes("not a wrapped asset")) return [];
      throw e;
    }
  }

  getDefaultOptions(): Op {
    return {};
  }

  async validate(request: RouteTransferRequest<N>, params: Tp): Promise<Vr> {
    // Check that source and destination chains are different
    if (request.fromChain.chain === request.toChain.chain) {
      return {
        valid: false,
        params,
        error: new Error("Source and destination chains cannot be the same"),
      };
    }

    const amount = request.parseAmount(params.amount);

    const validatedParams: Vp = {
      normalizedParams: {
        amount,
      },
      options: params.options ?? this.getDefaultOptions(),
      ...params,
    };

    return { valid: true, params: validatedParams };
  }

  async quote(request: RouteTransferRequest<N>, params: Vp): Promise<QR> {
    const eta =
      finality.estimateFinalityTime(request.fromChain.chain) + guardians.guardianAttestationEta;

    return {
      success: true,
      params,
      sourceToken: {
        token: request.source.id,
        amount: params.normalizedParams.amount,
      },
      destinationToken: {
        token: request.destination.id,
        amount: params.normalizedParams.amount,
      },
      eta,
      expires: time.expiration(24, 0, 0),
    };
  }

  async initiate(
    request: RouteTransferRequest<N>,
    signer: Signer,
    quote: Q,
    to: ChainAddress,
  ): Promise<R> {
    const amt = amount.units(quote.params.normalizedParams.amount);
    const isEthereum = request.fromChain.chain === "Ethereum";
    const nativeTbtc = TBTCBridge.getNativeTbtcToken(request.fromChain.chain);
    const isNativeTbtc = nativeTbtc && isSameToken(quote.sourceToken.token, nativeTbtc);

    if (isNativeTbtc && !isEthereum) {
      return await this.transferNative(request, signer, to, amt);
    }

    if (!isNativeTbtc && isEthereum) {
      throw new Error("Only tbtc can be transferred on Ethereum");
    }

    if (!isNativeTbtc) {
      const tb = await request.fromChain.getTokenBridge();
      const originalAsset = await tb.getOriginalAsset(quote.sourceToken.token.address);
      const ethTbtc = TBTCBridge.getNativeTbtcToken("Ethereum")!;
      if (!isSameToken(originalAsset, ethTbtc)) {
        throw new Error("Can only transfer wrapped tbtc");
      }
    }

    return await this.transferWrapped(request, signer, to, amt);
  }

  private async transferNative(
    request: RouteTransferRequest<N>,
    signer: Signer,
    to: ChainAddress,
    amt: bigint,
  ): Promise<R> {
    const sender = Wormhole.parseAddress(signer.chain(), signer.address());
    const bridge = await request.fromChain.getTBTCBridge();
    const xfer = bridge.transfer(sender, to, amt);
    const txIds = await signSendWait(request.fromChain, xfer, signer);

    const receipt: SourceInitiatedTransferReceipt = {
      originTxs: txIds,
      state: TransferState.SourceInitiated,
      from: request.fromChain.chain,
      to: request.toChain.chain,
    };

    return receipt;
  }

  private async transferWrapped(
    request: RouteTransferRequest<N>,
    signer: Signer,
    to: ChainAddress,
    amt: bigint,
  ): Promise<R> {
    const sender = Wormhole.parseAddress(signer.chain(), signer.address());
    const toGateway = contracts.tbtc.get(request.fromChain.network, to.chain);
    const tb = await request.fromChain.getTokenBridge();
    let xfer;

    if (toGateway) {
      // payload3 transfer to gateway contract
      xfer = tb.transfer(
        sender,
        Wormhole.chainAddress(request.toChain.chain, toGateway),
        request.source.id.address,
        amt,
        // payload is the recipient address
        to.address.toUniversalAddress().toUint8Array(),
      );
    } else {
      xfer = tb.transfer(sender, to, request.source.id.address, amt);
    }

    const txIds = await signSendWait(request.fromChain, xfer, signer);

    const receipt: SourceInitiatedTransferReceipt = {
      originTxs: txIds,
      state: TransferState.SourceInitiated,
      from: request.fromChain.chain,
      to: request.toChain.chain,
    };

    return receipt;
  }

  async complete(signer: Signer, receipt: R): Promise<R> {
    if (!isAttested(receipt)) {
      throw new Error("The source must be finalized in order to complete the transfer");
    }

    const sender = Wormhole.parseAddress(signer.chain(), signer.address());
    const vaa = receipt.attestation.attestation;
    const toChain = this.wh.getChain(receipt.to);
    let xfer;

    if (vaa.payloadLiteral === "TBTCBridge:GatewayTransfer") {
      const bridge = await toChain.getTBTCBridge();
      xfer = bridge.redeem(sender, vaa);
    } else {
      const tb = await toChain.getTokenBridge();
      // This is really a TokenBridge:Transfer VAA
      const serialized = serialize(vaa);
      const tbVaa = deserialize("TokenBridge:Transfer", serialized);
      xfer = tb.redeem(sender, tbVaa);
    }

    const dstTxIds = await signSendWait(toChain, xfer, signer);

    return {
      ...receipt,
      state: TransferState.DestinationInitiated,
      destinationTxs: dstTxIds,
    };
  }

  async resume(txid: TransactionId): Promise<R> {
    const vaa = await this.wh.getVaa(txid, TBTCBridge.getTransferDiscriminator());
    if (!vaa) throw new Error("No VAA found for transaction: " + txid.txid);

    const ethTbtc = TBTCBridge.getNativeTbtcToken("Ethereum")!;
    const { chain, address } = vaa.payload.token;
    if (!isSameToken(ethTbtc, { chain, address })) {
      throw new Error("Can only resume tbtc transfers");
    }

    return {
      originTxs: [txid],
      state: TransferState.Attested,
      from: vaa.emitterChain,
      to: vaa.payload.to.chain,
      attestation: {
        id: {
          chain: vaa.emitterChain,
          emitter: vaa.emitterAddress,
          sequence: vaa.sequence,
        },
        attestation: vaa,
      },
    } satisfies AttestedTransferReceipt<AttestationReceipt<"TBTCBridge">>;
  }

  async *track(receipt: Receipt, timeout?: number) {
    if (isSourceInitiated(receipt) || isSourceFinalized(receipt)) {
      const txid = receipt.originTxs[receipt.originTxs.length - 1]!;

      const vaa = await this.wh.getVaa(txid, TBTCBridge.getTransferDiscriminator(), timeout);
      if (!vaa) throw new Error("No VAA found for transaction: " + txid.txid);

      const msgId: WormholeMessageId = {
        chain: vaa.emitterChain,
        emitter: vaa.emitterAddress,
        sequence: vaa.sequence,
      };

      receipt = {
        ...receipt,
        state: TransferState.Attested,
        attestation: {
          id: msgId,
          attestation: vaa,
        },
      } satisfies AttestedTransferReceipt<AttestationReceipt<"TBTCBridge">>;

      yield receipt;
    }

    if (isAttested(receipt)) {
      const toChain = this.wh.getChain(receipt.to);
      const toBridge = await toChain.getTokenBridge();
      const isCompleted = await toBridge.isTransferCompleted(receipt.attestation.attestation);
      if (isCompleted) {
        receipt = {
          ...receipt,
          state: TransferState.DestinationFinalized,
        } satisfies CompletedTransferReceipt<AttestationReceipt<"TBTCBridge">>;

        yield receipt;
      }
    }

    yield receipt;
  }

  static async isSourceTokenSupported<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
  ): Promise<boolean> {
    if (isNative(sourceToken.address)) {
      return false;
    }

    // Native tbtc is supported
    const nativeTbtc = TBTCBridge.getNativeTbtcToken(fromChain.chain);
    if (nativeTbtc && isSameToken(sourceToken, nativeTbtc)) {
      return true;
    }

    // Wormhole-wrapped Ethereum tbtc is supported
    const tb = await fromChain.getTokenBridge();
    try {
      const originalAsset = await tb.getOriginalAsset(sourceToken.address);
      return isSameToken(originalAsset, TBTCBridge.getNativeTbtcToken("Ethereum")!);
    } catch (e: any) {
      if (e.message.includes("not a wrapped asset")) return false;
      throw e;
    }
  }
}
