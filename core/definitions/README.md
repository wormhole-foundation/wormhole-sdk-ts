# Definitions SDK

Replaces these files from old sdk:
  * vaa/parser
  * mock

## VAA

### Deserialization

```ts
// decode VAA
const vaaBytes = Buffer.from(testCase.vaa, "base64");
// deserializes the base VAA details (emitterChain, emitterAddress, sequence, signatures, payload, hash, etc)
const parsed = deserialize("Uint8Array", new Uint8Array(vaaBytes));
// deserialize the payload, first argument denotes the type of payload
const deserialized = deserializePayload("BAMessage", parsed.payload);
```

#### Available payload types

Token Bridge:
- "AttestMeta"
- "Transfer"
- "TransferWithPayload

Generic Relayer:
- "DeliveryInstruction"
- "RedeliveryInstruction"
- "DeliveryOverride"

Governance
- "WormholeCoreUpgradeContract"
- "WormholeCoreGuardianSetUpgrade"
- "WormholeCoreSetMessageFee"
- "WormholeCoreTransferFees"
- "WormholeCoreRecoverChainId"
- "TokenBridgeRegisterChain"
- "TokenBridgeUpgradeContract"
- "TokenBridgeRecoverChainId"
- "NftBridgeRegisterChain"
- "NftBridgeUpgradeContract"
- "NftBridgeRecoverChainId"
- "RelayerRegisterChain"
- "RelayerUpgradeContract"
- "RelayerUpdateDefaultProvider"

Circle
- "CircleTransferRelay"

BAM
- "BAMessage"
