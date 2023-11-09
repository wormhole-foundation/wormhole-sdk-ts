// import {
//     AptosAccount,
//     AptosClient,
//     BCS,
//     TokenTypes,
//     TxnBuilderTypes,
//     Types,
// } from "aptos";
//
// /**
//  * Generate, sign, and submit a transaction calling the given entry function with the given
//  * arguments. Prevents transaction submission and throws if the transaction fails.
//  *
//  * This is separated from `generateSignAndSubmitScript` because it makes use of `AptosClient`'s
//  * `generateTransaction` which pulls ABIs from the node and uses them to encode arguments
//  * automatically.
//  * @param client Client used to transfer data to/from Aptos node
//  * @param sender Account that will submit transaction
//  * @param payload Payload containing unencoded fully qualified entry function, types, and arguments
//  * @param opts Override default transaction options
//  * @returns Data from transaction after is has been successfully submitted to mempool
//  */
// export const generateSignAndSubmitEntryFunction = (
//     client: AptosClient,
//     sender: AptosAccount,
//     payload: Types.EntryFunctionPayload,
//     opts?: Partial<Types.SubmitTransactionRequest>
// ): Promise<Types.UserTransaction> => {
//     return client
//         .generateTransaction(sender.address(), payload, opts)
//         .then(
//             (rawTx) =>
//                 signAndSubmitTransaction(
//                     client,
//                     sender,
//                     rawTx
//                 ) as Promise<Types.UserTransaction>
//         );
// };
//
// /**
//  * Generate, sign, and submit a transaction containing given bytecode. Prevents transaction
//  * submission and throws if the transaction fails.
//  *
//  * Unlike `generateSignAndSubmitEntryFunction`, this function must construct a `RawTransaction`
//  * manually because `generateTransaction` does not have support for scripts for which there are
//  * no corresponding on-chain ABIs. Type/argument encoding is left to the caller.
//  * @param client Client used to transfer data to/from Aptos node
//  * @param sender Account that will submit transaction
//  * @param payload Payload containing compiled bytecode and encoded types/arguments
//  * @param opts Override default transaction options
//  * @returns Data from transaction after is has been successfully submitted to mempool
//  */
// export const generateSignAndSubmitScript = async (
//     client: AptosClient,
//     sender: AptosAccount,
//     payload: TxnBuilderTypes.TransactionPayloadScript,
//     opts?: Partial<Types.SubmitTransactionRequest>
// ) => {
//     // overwriting `max_gas_amount` and `gas_unit_price` defaults
//     // rest of defaults are defined here: https://aptos-labs.github.io/ts-sdk-doc/classes/AptosClient.html#generateTransaction
//     const customOpts = Object.assign(
//         {
//             gas_unit_price: "100",
//             max_gas_amount: "30000",
//         },
//         opts
//     );
//
//     // create raw transaction
//     const [{ sequence_number: sequenceNumber }, chainId] = await Promise.all([
//         client.getAccount(sender.address()),
//         client.getChainId(),
//     ]);
//     const rawTx = new TxnBuilderTypes.RawTransaction(
//         TxnBuilderTypes.AccountAddress.fromHex(sender.address()),
//         BigInt(sequenceNumber),
//         payload,
//         BigInt(customOpts.max_gas_amount),
//         BigInt(customOpts.gas_unit_price),
//         BigInt(Math.floor(Date.now() / 1000) + 10),
//         new TxnBuilderTypes.ChainId(chainId)
//     );
//     // sign & submit transaction
//     return signAndSubmitTransaction(client, sender, rawTx);
// };
//
//

//
// /**
//  * Hashes the given type. Because fully qualified types are a concept unique to Aptos, this
//  * output acts as the address on other chains.
//  * @param fullyQualifiedType Fully qualified type on Aptos
//  * @returns External address corresponding to given type
//  */
// export const getExternalAddressFromType = (
//     fullyQualifiedType: string
// ): string => {
//     // hash the type so it fits into 32 bytes
//     return sha3_256(fullyQualifiedType);
// };
//

//
// /**
//  * Get a hash that uniquely identifies a collection on Aptos.
//  * @param tokenId
//  * @returns Collection hash
//  */
// export const deriveCollectionHashFromTokenId = async (
//     tokenId: TokenTypes.TokenId
// ): Promise<Uint8Array> => {
//     const inputs = Buffer.concat([
//         BCS.bcsToBytes(
//             TxnBuilderTypes.AccountAddress.fromHex(tokenId.token_data_id.creator)
//         ),
//         Buffer.from(sha3_256(tokenId.token_data_id.collection), "hex"),
//     ]);
//     return new Uint8Array(Buffer.from(sha3_256(inputs), "hex"));
// };
//
// /**
//  * Get a hash that uniquely identifies a token on Aptos.
//  *
//  * Native tokens in Aptos are uniquely identified by a hash of creator address,
//  * collection name, token name, and property version. This hash is converted to
//  * a bigint in the `tokenId` field in NFT transfer VAAs.
//  * @param tokenId
//  * @returns Token hash identifying the token
//  */
// export const deriveTokenHashFromTokenId = async (
//     tokenId: TokenTypes.TokenId
// ): Promise<Uint8Array> => {
//     const propertyVersion = Buffer.alloc(8);
//     propertyVersion.writeBigUInt64BE(BigInt(tokenId.property_version));
//     const inputs = Buffer.concat([
//         BCS.bcsToBytes(
//             TxnBuilderTypes.AccountAddress.fromHex(tokenId.token_data_id.creator)
//         ),
//         Buffer.from(sha3_256(tokenId.token_data_id.collection), "hex"),
//         Buffer.from(sha3_256(tokenId.token_data_id.name), "hex"),
//         propertyVersion,
//     ]);
//     return new Uint8Array(Buffer.from(sha3_256(inputs), "hex"));
// };
//
//
