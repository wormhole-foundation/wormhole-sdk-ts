import type { VAA, WormholeCore } from "@wormhole-foundation/sdk";
import { SignatureUtils, encoding, keccak256, serialize, wormhole } from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/evm";

// If a VAA contains signatures from an older guardian set, it can be repaired by removing the invalid signatures and setting the new guardian set index.

(async function () {
  const wh = await wormhole("Mainnet", [evm]);
  const eth = wh.getChain("Ethereum");

  const core = await eth.getWormholeCore();
  const index = await core.getGuardianSetIndex();
  const gset = await core.getGuardianSet(index);

  const vaa = await wh.getVaa(
    "07D6A246859FAB4A93FFF2AE1F3B4CB794754226560F3886BE01A39F3204E148",
    "Uint8Array",
  );

  const before = serialize(vaa!);
  const after = repairVaa(vaa!, gset);
  if (encoding.bytes.equals(before, after)) {
    console.log("VAA is already valid", encoding.hex.encode(before));
  } else {
    console.log("VAA has been repaired: ", encoding.hex.encode(after));
  }
})();

export function repairVaa(vaa: VAA<"Uint8Array">, guardianSetData: WormholeCore.GuardianSet) {
  if (vaa.guardianSet === guardianSetData.index) return serialize(vaa);

  // Rehash the vaa digest since signatures are based on double hash
  const digest = keccak256(vaa.hash);

  // Filter any invalid signatures
  const currentGuardianSet = guardianSetData.keys.map((key) => encoding.hex.decode(key));
  const validSignatures = vaa.signatures.filter((signature) => {
    try {
      return !encoding.bytes.equals(
        currentGuardianSet[signature.guardianIndex]!,
        SignatureUtils.recover(signature.signature, digest),
      );
    } catch (_) {}
    return false;
  });
  console.log(vaa.guardianSet, guardianSetData.index);
  console.log(vaa.signatures.length, validSignatures.length);

  // re-construct vaa with signatures that remain
  const minNumSignatures = Math.floor((2.0 * currentGuardianSet.length) / 3.0) + 1;
  if (validSignatures.length < minNumSignatures)
    throw new Error(`There are not enough valid signatures to repair.`);

  // @ts-ignore -- readonly
  vaa.signatures = validSignatures;
  // @ts-ignore -- readonly
  vaa.guardianSet = guardianSetData.index;

  return serialize(vaa);
}
