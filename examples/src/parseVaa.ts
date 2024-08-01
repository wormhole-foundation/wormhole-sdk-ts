import type { Layout } from "@wormhole-foundation/sdk";
import {
  UniversalAddress,
  createVAA,
  deserialize,
  serialize,
  encoding,
  serializeLayout,
  deserializeLayout,
} from "@wormhole-foundation/sdk";

(async function () {
  // EXAMPLE_PARSE_VAA
  // Create a fake vaa and serialize it to bytes
  // the first argument to `createVAA` describes the payload type
  // in this case, just a Uint8Array of bytes
  const fakeVaaBytes = serialize(
    createVAA("Uint8Array", {
      guardianSet: 0,
      timestamp: 0,
      nonce: 0,
      emitterChain: "Solana",
      emitterAddress: new UniversalAddress(new Uint8Array(32)),
      sequence: 0n,
      consistencyLevel: 0,
      signatures: [],
      payload: encoding.bytes.encode("hi"),
    }),
  );
  // Deserialize the VAA back into a data structure, in this case
  // decoding the payload back into bytes.
  // Using Uint8Array will always work but you can use a more specific payload layout type
  console.log(deserialize("Uint8Array", fakeVaaBytes));
  // EXAMPLE_PARSE_VAA

  // EXAMPLE_PARSE_TOKEN_TRANSFER_VAA
  // Create a token bridge VAA and serialize it
  // The payload type argument here is "TokenBridge:Transfer"
  // which is defined in the the TokenBridge protocol definition
  const tokenBridgeVaaBytes = serialize(
    createVAA("TokenBridge:Transfer", {
      guardianSet: 0,
      timestamp: 0,
      nonce: 0,
      emitterChain: "Solana",
      emitterAddress: new UniversalAddress(new Uint8Array(32)),
      sequence: 0n,
      consistencyLevel: 0,
      signatures: [],
      payload: {
        fee: 0n,
        token: {
          amount: 0n,
          address: new UniversalAddress(new Uint8Array(32)),
          chain: "Solana",
        },
        to: {
          chain: "Ethereum",
          address: new UniversalAddress(new Uint8Array(32)),
        },
      },
    }),
  );
  // Although we know the payload type is "TokenBridge:Transfer",
  // we can still deserialize it as a Uint8Array
  console.log(deserialize("Uint8Array", tokenBridgeVaaBytes));
  // Or use the correct payload type to get a more specific data structure
  console.log(deserialize("TokenBridge:Transfer", tokenBridgeVaaBytes));
  // EXAMPLE_PARSE_TOKEN_TRANSFER_VAA

  // EXAMPLE_PARSE_CUSTOM_VAA

  // First define a custom payload layout
  const customPayloadLayout = [
    // 2 byte integer
    { name: "bar", binary: "uint", size: 2 },
    // arbitrary bytes, note this will take the rest of the payload
    { name: "foo", binary: "bytes" },
  ] as const satisfies Layout;

  // Now serialize a VAA with the custom payload layout
  const customVaaBytes = serialize(
    createVAA("Uint8Array", {
      guardianSet: 0,
      timestamp: 0,
      nonce: 0,
      emitterChain: "Solana",
      emitterAddress: new UniversalAddress(new Uint8Array(32)),
      sequence: 0n,
      consistencyLevel: 0,
      signatures: [],
      // Using `serializeLayout` with the custom layout we created above
      payload: serializeLayout(customPayloadLayout, {
        bar: 42,
        foo: new Uint8Array([1, 2, 3]),
      }),
    }),
  );
  // Deserialize the VAA to get the custom payload
  const vaa = deserialize("Uint8Array", customVaaBytes);
  console.log(encoding.hex.encode(vaa.payload));
  console.log(deserializeLayout(customPayloadLayout, vaa.payload));
  // EXAMPLE_PARSE_CUSTOM_VAA
})();
