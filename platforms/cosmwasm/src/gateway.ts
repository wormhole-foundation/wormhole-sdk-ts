import {
  ChainName,
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
  isGatewayTransferMsg,
  PlatformToChains,
  TokenId,
  keccak256,
  sha256,
  toChainId,
  toChainName,
} from '@wormhole-foundation/connect-sdk';
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import bs58 from 'bs58';

import { IBC_PORT, networkChainToChannelId } from './constants';
import { CosmwasmUtils } from './platformUtils';
import { CosmwasmPlatform } from './platform';
import { CosmwasmAddress } from './address';
import { CosmwasmTokenBridge } from './protocols/tokenBridge';
import { CosmwasmChainName, IBCTransferData, IBCTransferInfo } from './types';
import { Tx } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SearchTxsResult } from 'cosmjs-types/cosmos/base/abci/v1beta1/abci';

export module Gateway {
  export const name: ChainName = 'Wormchain';

  export function address(): string {
    return CosmwasmPlatform.contracts.getContracts(name).gateway!;
  }

  // Returns RPC client for Wormchain
  export async function getRpc(): Promise<CosmWasmClient> {
    const rpcAddress = CosmwasmPlatform.conf[name]!.rpc;
    return await CosmWasmClient.connect(rpcAddress);
  }

  export async function getTokenBridge(
    rpc?: CosmWasmClient,
  ): Promise<CosmwasmTokenBridge> {
    rpc = rpc ? rpc : await getRpc();
    return CosmwasmPlatform.getTokenBridge(rpc);
  }

  // Get the wrapped version of an asset created on wormchain
  // for a given chain
  export async function getWrappedAsset(
    token: TokenId,
    chain: PlatformToChains<'Cosmwasm'>,
  ): Promise<CosmwasmAddress> {
    const tb = await getTokenBridge();
    const wrappedAsset = await tb.getWrappedAsset(token);

    // TODO:
    if (CosmwasmPlatform.isNativeDenom(chain, wrappedAsset.toString()))
      return wrappedAsset as unknown as CosmwasmAddress;

    // Encode the original address to base58 and add it
    // to the factory address for cw20 style factory token address
    const encodedAddress = bs58.encode(
      wrappedAsset.toUniversalAddress().toUint8Array(),
    );
    const factoryAddress = `factory/${address()}/${encodedAddress}`;

    return await deriveIbcDenom(chain, factoryAddress);
  }

  // Returns the destination channel on wormchain for given source chain
  export async function getDestinationChannel(
    chain: CosmwasmChainName,
    rpc?: CosmWasmClient,
  ): Promise<string> {
    // @ts-ignore
    if (networkChainToChannelId.has(CosmwasmPlatform.network, chain)) {
      const [_, channel] = networkChainToChannelId.get(
        CosmwasmPlatform.network,
        // @ts-ignore
        chain,
      );
      return channel;
    }

    rpc = rpc ? rpc : await getRpc();
    const queryClient = CosmwasmUtils.asQueryClient(rpc);

    const sourceChannel = await getSourceChannel(chain, rpc);
    const conn = await queryClient.ibc.channel.channel(IBC_PORT, sourceChannel);
    const destChannel = conn.channel?.counterparty?.channelId;
    if (!destChannel) {
      throw new Error(`No destination channel found on chain ${chain}`);
    }
    return destChannel;
  }

  // Gets the source channel on wormchain for a given chain
  export async function getSourceChannel(
    chain: CosmwasmChainName,
    rpc?: CosmWasmClient,
  ): Promise<string> {
    // @ts-ignore
    if (networkChainToChannelId.has(CosmwasmPlatform.network, chain)) {
      const [channel, _] = networkChainToChannelId.get(
        CosmwasmPlatform.network,
        // @ts-ignore
        chain,
      );
      return channel;
    }

    rpc = rpc ? rpc : await getRpc();
    try {
      const { channel } = await rpc.queryContractSmart(address(), {
        ibc_channel: { chain_id: toChainId(chain) },
      });
      return channel;
    } catch {
      throw new Error('No source channel found for chain ' + chain);
    }
  }

  // Derive the Token Address with context for whether or not its managed
  // https://github.com/wormhole-foundation/wormhole/blob/251e6c4a6478379ff862aed08d835f9022ef4143/cosmwasm/contracts/token-bridge/src/token_address.rs#L12
  export function deriveTokenAddress(
    chain: ChainName,
    asset: string,
  ): Uint8Array {
    const tokenId = new Uint8Array(32);
    const nativeFlg = CosmwasmPlatform.isNativeDenom(chain, asset) ? 1 : 0;
    tokenId.set([nativeFlg], 0);
    tokenId.set(keccak256(asset).slice(1), 1);
    return tokenId;
  }

  export async function deriveIbcDenom(
    chain: CosmwasmChainName,
    denom: string,
  ): Promise<CosmwasmAddress> {
    const channel = await getDestinationChannel(chain);
    const hashData = Buffer.from(`transfer/${channel}/${denom}`);
    const hash = Buffer.from(sha256(hashData)).toString('hex');
    return new CosmwasmAddress(`ibc/${hash.toUpperCase()}`);
  }

  // Returns the IBC Transfer message content and sequence number information
  export async function ibcTransfer(
    payload: GatewayTransferMsg | GatewayTransferWithPayloadMsg,
    rpc?: CosmWasmClient,
  ): Promise<IBCTransferInfo> {
    rpc = rpc ? rpc : await getRpc();

    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64',
    );

    // Find the transaction with matching payload
    const txResults = await rpc.searchTx([
      {
        key: 'wasm.transfer_payload',
        value: encodedPayload,
      },
    ]);

    if (txResults.length !== 1)
      throw new Error(
        `Expected 1 transaction, got ${txResults.length} found for payload: ${encodedPayload}`,
      );

    const [tx] = txResults;

    tx.events.forEach((e) => console.log(e));

    // Find packet the sequence from the IBC send event
    const seq = tx.events
      .find((ev) => ev.type === 'send_packet')
      ?.attributes.find((attr) => attr.key === 'packet_sequence');
    if (!seq) throw new Error('No event found to identify sequence number');

    const sequence = Number(seq.value);

    const _data = tx.events
      .find((ev) => ev.type === 'send_packet')
      ?.attributes.find((attr) => attr.key === 'packet_data');

    const data = (_data ? JSON.parse(_data.value) : {}) as IBCTransferData;

    // what channel should we check for this transfer?
    const finalDest = toChainName(
      isGatewayTransferMsg(payload)
        ? payload.gateway_transfer.chain
        : payload.gateway_transfer_with_payload.chain,
    ) as CosmwasmChainName;

    const srcChan = await getSourceChannel(finalDest, rpc);
    const dstChan = await getDestinationChannel(finalDest, rpc);

    const qc = CosmwasmUtils.asQueryClient(rpc);

    const common = { sequence, srcChan, dstChan, data };

    // If its present in the commitment results, its interpreted as in-flight
    // the client throws an error and we report any error as not in-flight
    try {
      await qc.ibc.channel.packetCommitment(IBC_PORT, srcChan, sequence);
      return { ...common, pending: true };
    } catch (e) {
      // TODO: catch http errors unrelated to no commitment in flight
      // otherwise we might lie about pending = true
    }

    return { ...common, pending: false };
  }
}
