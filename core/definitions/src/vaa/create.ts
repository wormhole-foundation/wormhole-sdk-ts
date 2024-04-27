//For whatever reason if we put this in the same file as the other functions, tsc runs out of
//  memory. For some extra lulz, try turning createVAA into an arrow function (spoiler: also
//  causes out of memory fireworks)

import type { DynamicItemsOfLayout, LayoutToType } from "@wormhole-foundation/sdk-base";
import { addFixedValues, serializeLayout } from "@wormhole-foundation/sdk-base";

import { keccak256 } from "../utils.js";
import type { PayloadLiteral } from "./registration.js";
import type { baseLayout, VAA } from "./vaa.js";
import { decomposeLiteral, headerLayout, envelopeLayout } from "./vaa.js";
import type { PayloadLiteralToPayloadItemLayout } from "./functions.js";
import { payloadLiteralToPayloadItemLayout } from "./functions.js";

type BodyLayout<PL extends PayloadLiteral> = [
  ...typeof envelopeLayout,
  PayloadLiteralToPayloadItemLayout<PL>,
];

function bodyLayout<PL extends PayloadLiteral>(payloadLiteral: PL) {
  return [...envelopeLayout, payloadLiteralToPayloadItemLayout(payloadLiteral)] as BodyLayout<PL>;
}

type DynamicProperties<PL extends PayloadLiteral> = LayoutToType<
  DynamicItemsOfLayout<[...typeof baseLayout, PayloadLiteralToPayloadItemLayout<PL>]>
>;

/**
 * Create a VAA from a payload literal and a set of dynamic properties.
 * @param payloadLiteral The payload literal to create a VAA for.
 * @param vaaData The dynamic properties to include in the VAA.
 * @returns A VAA with the given payload literal and dynamic properties.
 * @throws If the dynamic properties do not match the payload literal.
 */
export function createVAA<PL extends PayloadLiteral>(
  payloadLiteral: PL,
  vaaData: DynamicProperties<PL>,
): VAA<PL> {
  const [protocolName, payloadName] = decomposeLiteral(payloadLiteral);
  const bodyWithFixed = addFixedValues(bodyLayout(payloadLiteral), vaaData as any);
  return {
    protocolName,
    payloadName,
    payloadLiteral,
    ...addFixedValues(headerLayout, vaaData as any),
    ...bodyWithFixed,
    hash: keccak256(serializeLayout(bodyLayout(payloadLiteral), bodyWithFixed)),
  } as unknown as VAA<PL>;
}
