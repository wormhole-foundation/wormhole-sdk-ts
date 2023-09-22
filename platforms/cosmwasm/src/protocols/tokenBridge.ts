import {
  Network,
  VAA,
  ChainAddress,
  TokenBridge,
  TxHash,
  TokenId,
  NativeAddress,
  TokenTransferTransaction,
} from "@wormhole-foundation/connect-sdk";

import { cosmwasmChainIdToNetworkChainPair } from "../constants";
import {
  CosmwasmTransaction,
  CosmwasmUnsignedTransaction,
} from "../unsignedTransaction";
import { CosmwasmContracts } from "../contracts";
import { CosmwasmChainName, UniversalOrCosmwasm } from "../types";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { CosmwasmPlatform } from "../platform";

//Currently the code does not consider Wormhole msg fee (because it is and always has been 0).

//TODO more checks to determine that all necessary preconditions are met (e.g. that balances are
//  sufficient) for a given transaction to succeed

export class CosmwasmTokenBridge implements TokenBridge<"Cosmwasm"> {
  private constructor(
    readonly network: Network,
    readonly chain: CosmwasmChainName,
    readonly provider: CosmWasmClient,
    readonly contracts: CosmwasmContracts
  ) {
    //this.tokenBridge = this.contracts.mustGetTokenBridge(chain, provider);
  }

  static async fromProvider(
    provider: CosmWasmClient,
    contracts: CosmwasmContracts
  ): Promise<CosmwasmTokenBridge> {
    const [network, chain] = await CosmwasmPlatform.chainFromRpc(provider);
    return new CosmwasmTokenBridge(network, chain, provider, contracts);
  }

  async isWrappedAsset(token: UniversalOrCosmwasm): Promise<boolean> {
    throw new Error("Not implemented");
    //return await this.tokenBridge.isWrappedAsset(toCosmwasmAddrString(token));
  }

  async getOriginalAsset(token: UniversalOrCosmwasm): Promise<TokenId> {
    throw new Error("Not implemented");
    // if (!(await this.isWrappedAsset(token)))
    //   throw ErrNotWrapped(token.toString());

    // const tokenContract = TokenContractFactory.connect(
    //   toCosmwasmAddrString(token),
    //   this.provider
    // );
    // const [chain, address] = await Promise.all([
    //   tokenContract.chainId().then(Number).then(toChainId).then(chainIdToChain),
    //   tokenContract.nativeContract().then((addr) => new UniversalAddress(addr)),
    // ]);
    // return { chain, address };
  }

  async hasWrappedAsset(token: TokenId): Promise<boolean> {
    throw new Error("Not implemented");
    try {
      //TODO it's unclear to me why this would throw for a non-existent token but that's how the
      //  old sdk checked for existence
      await this.getWrappedAsset(token);
      return true;
    } catch (e) {}
    return false;
  }

  async getWrappedAsset(token: TokenId): Promise<NativeAddress<"Cosmwasm">> {
    throw new Error("Not implemented");
    //const wrappedAddress = await this.tokenBridge.wrappedAsset(
    //  toChainId(token.chain),
    //  token.address.toUniversalAddress().toString()
    //);

    //if (wrappedAddress === CosmwasmZeroAddress)
    //  throw ErrNotWrapped(token.address.toUniversalAddress().toString());

    //return toNative("Cosmwasm", wrappedAddress);
  }

  async isTransferCompleted(
    vaa: VAA<"Transfer"> | VAA<"TransferWithPayload">
  ): Promise<boolean> {
    throw new Error("Not implemented");
    //The double keccak here is neccessary due to a fuckup in the original implementation of the
    //  EVM core bridge:
    //Guardians don't sign messages (bodies) but explicitly hash them via keccak256 first.
    //However, they use an ECDSA scheme for signing where the first step is to hash the "message"
    //  (which at this point is already the digest of the original message/body!)
    //Now, on EVM, ecrecover expects the final digest (i.e. a bytes32 rather than a dynamic bytes)
    //  i.e. it does no hashing itself. Therefore the EVM core bridge has to hash the body twice
    //  before calling ecrecover. But in the process of doing so, it erroneously sets the doubly
    //  hashed value as vm.hash instead of using the only once hashed value.
    //And finally this double digest is then used in a mapping to store whether a VAA has already
    //  been redeemed or not, which is ultimately the reason why we have to keccak the hash one
    //  more time here.
    //return this.tokenBridge.isTransferCompleted(keccak256(vaa.hash));
  }

  async *createAttestation(
    token: UniversalOrCosmwasm
  ): AsyncGenerator<CosmwasmUnsignedTransaction> {
    throw new Error("Not implemented");
    //const ignoredNonce = 0;
    //yield this.createUnsignedTx(
    //  await this.tokenBridge.attestToken.populateTransaction(
    //    toCosmwasmAddrString(token),
    //    ignoredNonce
    //  ),
    //  "TokenBridge.createAttestation"
    //);
  }

  async *submitAttestation(
    vaa: VAA<"AttestMeta">
  ): AsyncGenerator<CosmwasmUnsignedTransaction> {
    throw new Error("Not implemented");
    //const func = (await this.hasWrappedAsset({
    //  ...vaa.payload.token,
    //}))
    //  ? "createWrapped"
    //  : "updateWrapped";
    //yield this.createUnsignedTx(
    //  await this.tokenBridge[func].populateTransaction(serialize(vaa)),
    //  "TokenBridge." + func
    //);
  }

  //alternative naming: initiateTransfer
  async *transfer(
    sender: UniversalOrCosmwasm,
    recipient: ChainAddress,
    token: UniversalOrCosmwasm | "native",
    amount: bigint,
    payload?: Uint8Array
  ): AsyncGenerator<CosmwasmUnsignedTransaction> {
    throw new Error("Not implemented");
    // const senderAddr = toCosmwasmAddrString(sender);
    // const recipientChainId = toChainId(recipient.chain);
    // const recipientAddress = recipient.address
    //   .toUniversalAddress()
    //   .toUint8Array();
    // if (typeof token === "string" && token === "native") {
    //   const txReq = await (payload === undefined
    //     ? this.tokenBridge.wrapAndTransferETH.populateTransaction(
    //         recipientChainId,
    //         recipientAddress,
    //         unusedArbiterFee,
    //         unusedNonce,
    //         { value: amount }
    //       )
    //     : this.tokenBridge.wrapAndTransferETHWithPayload.populateTransaction(
    //         recipientChainId,
    //         recipientAddress,
    //         unusedNonce,
    //         payload,
    //         { value: amount }
    //       ));
    //   yield this.createUnsignedTx(
    //     addFrom(txReq, senderAddr),
    //     "TokenBridge.wrapAndTransferETH" +
    //       (payload === undefined ? "" : "WithPayload")
    //   );
    // } else {
    //   //TODO check for ERC-2612 (permit) support on token?
    //   const tokenAddr = toCosmwasmAddrString(token);
    //   const tokenContract = TokenContractFactory.connect(
    //     tokenAddr,
    //     this.provider
    //   );
    //   const allowance = await tokenContract.allowance(
    //     senderAddr,
    //     this.tokenBridge.target
    //   );
    //   if (allowance < amount) {
    //     const txReq = await tokenContract.approve.populateTransaction(
    //       this.tokenBridge.target,
    //       amount
    //     );
    //     yield this.createUnsignedTx(
    //       addFrom(txReq, senderAddr),
    //       "ERC20.approve of TokenBridge"
    //     );
    //   }
    //   const sharedParams = [
    //     tokenAddr,
    //     amount,
    //     recipientChainId,
    //     recipientAddress,
    //   ] as const;
    //   const txReq = await (payload === undefined
    //     ? this.tokenBridge.transferTokens.populateTransaction(
    //         ...sharedParams,
    //         unusedArbiterFee,
    //         unusedNonce
    //       )
    //     : this.tokenBridge.transferTokensWithPayload.populateTransaction(
    //         ...sharedParams,
    //         unusedNonce,
    //         payload
    //       ));
    //   yield this.createUnsignedTx(
    //     addFrom(txReq, senderAddr),
    //     "TokenBridge.transferTokens" +
    //       (payload === undefined ? "" : "WithPayload")
    //   );
    // }
  }

  //alternative naming: completeTransfer
  async *redeem(
    sender: UniversalOrCosmwasm,
    vaa: VAA<"Transfer"> | VAA<"TransferWithPayload">,
    unwrapNative: boolean = true
  ): AsyncGenerator<CosmwasmUnsignedTransaction> {
    throw new Error("Not implemented");
    // const senderAddr = toCosmwasmAddrString(sender);
    // if (vaa.payload.token.chain !== this.chain)
    //   if (vaa.payloadLiteral === "TransferWithPayload") {
    //     const fromAddr = toNative(this.chain, vaa.payload.from).unwrap();
    //     if (fromAddr !== senderAddr)
    //       throw new Error(
    //         `VAA.from (${fromAddr}) does not match sender (${senderAddr})`
    //       );
    //   }
    // const wrappedNativeAddr = await this.tokenBridge.WETH();
    // const tokenAddr = toNative(this.chain, vaa.payload.token.address).unwrap();
    // if (tokenAddr === wrappedNativeAddr && unwrapNative) {
    //   const txReq =
    //     await this.tokenBridge.completeTransferAndUnwrapETH.populateTransaction(
    //       serialize(vaa)
    //     );
    //   yield this.createUnsignedTx(
    //     addFrom(txReq, senderAddr),
    //     "TokenBridge.completeTransferAndUnwrapETH"
    //   );
    // } else {
    //   const txReq = await this.tokenBridge.completeTransfer.populateTransaction(
    //     serialize(vaa)
    //   );
    //   yield this.createUnsignedTx(
    //     addFrom(txReq, senderAddr),
    //     "TokenBridge.completeTransfer"
    //   );
    // }
  }

  async parseTransactionDetails(
    txid: TxHash
  ): Promise<TokenTransferTransaction[]> {
    throw new Error("Not implemented");
    // const receipt = await this.provider.getTransactionReceipt(txid);
    // if (receipt === null)
    //   throw new Error(`No transaction found with txid: ${txid}`);

    // const { fee: gasFee } = receipt;

    // const core = this.contracts.mustGetCore(this.chain, this.provider);
    // const coreAddress = await core.getAddress();

    // const bridge = this.contracts.mustGetTokenBridge(this.chain, this.provider);
    // const bridgeAddress = toNative(
    //   this.chain,
    //   await bridge.getAddress()
    // ).toUniversalAddress();

    // const bridgeLogs = receipt.logs.filter((l: any) => {
    //   return l.address === coreAddress;
    // });

    // const impl = this.contracts.getCoreImplementationInterface();

    // const parsedLogs = bridgeLogs.map(async (bridgeLog) => {
    //   const { topics, data } = bridgeLog;
    //   const parsed = impl.parseLog({ topics: topics.slice(), data });

    //   // TODO: should we be nicer here?
    //   if (parsed === null) throw new Error(`Failed to parse logs: ${data}`);

    //   // parse token bridge message, 0x01 == transfer, attest == 0x02,  w/ payload 0x03
    //   let parsedTransfer:
    //     | BridgeStructs.TransferStructOutput
    //     | BridgeStructs.TransferWithPayloadStructOutput;

    //   if (parsed.args.payload.startsWith("0x01")) {
    //     // parse token bridge transfer data
    //     parsedTransfer = await bridge.parseTransfer(parsed.args.payload);
    //   } else if (parsed.args.payload.startsWith("0x03")) {
    //     // parse token bridge transfer with payload data
    //     parsedTransfer = await bridge.parseTransferWithPayload(
    //       parsed.args.payload
    //     );
    //   } else {
    //     // git gud
    //     throw new Error(
    //       `unrecognized payload for ${txid}: ${parsed.args.payload}`
    //     );
    //   }

    //   const toChain = toChainName(parsedTransfer.toChain);
    //   const tokenAddress = new UniversalAddress(parsedTransfer.tokenAddress);
    //   const tokenChain = toChainName(parsedTransfer.tokenChain);

    //   const ttt: TokenTransferTransaction = {
    //     message: {
    //       tx: { chain: this.chain, txid },
    //       msg: {
    //         chain: this.chain,
    //         emitter: bridgeAddress,
    //         sequence: parsed.args.sequence,
    //       },
    //       payloadId: parsedTransfer.payloadID,
    //     },
    //     details: {
    //       token: { chain: tokenChain, address: tokenAddress },
    //       amount: parsedTransfer.amount,
    //       from: {
    //         chain: this.chain,
    //         address: toNative(this.chain, receipt.from),
    //       },
    //       to: {
    //         chain: toChain,
    //         address: toNative(toChain, parsedTransfer.to),
    //       },
    //     },
    //     block: BigInt(receipt.blockNumber),
    //     gasFee,
    //   };
    //   return ttt;
    // });

    // return await Promise.all(parsedLogs);
  }

  async getWrappedNative(): Promise<NativeAddress<"Cosmwasm">> {
    throw new Error("Not implemented");
    //const address = await this.tokenBridge.WETH();
    //return toNative(this.chain, address);
  }

  private createUnsignedTx(
    txReq: CosmwasmTransaction,
    description: string,
    parallelizable: boolean = false
  ): CosmwasmUnsignedTransaction {
    return new CosmwasmUnsignedTransaction(
      txReq,
      this.network,
      this.chain,
      description,
      parallelizable
    );
  }
}
