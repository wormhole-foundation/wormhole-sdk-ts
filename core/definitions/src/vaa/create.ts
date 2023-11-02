//For whatever reason if we put this in the same file as the other functions, tsc runs out of
//  memory. For some extra lulz, try turning createVAA into an arrow function (spoiler: also
//  causes out of memory fireworks)

import {
  DynamicItemsOfLayout,
  LayoutToType,
  addFixedValues,
  serializeLayout,
} from "@wormhole-foundation/sdk-base";

import { keccak256 } from "../utils";
import { PayloadLiteral } from "./registration";
import { decomposeLiteral, headerLayout, envelopeLayout, baseLayout, VAA } from "./vaa";
import { PayloadLiteralToPayloadItemLayout, payloadLiteralToPayloadItemLayout } from "./functions";

type BodyLayout<PL extends PayloadLiteral> = [
  ...typeof envelopeLayout,
  ...PayloadLiteralToPayloadItemLayout<PL>,
];

function bodyLayout<PL extends PayloadLiteral>(payloadLiteral: PL) {
  return [
    ...envelopeLayout,
    ...payloadLiteralToPayloadItemLayout(payloadLiteral),
  ] as BodyLayout<PL>;
}

type DynamicProperties<PL extends PayloadLiteral> = LayoutToType<
  DynamicItemsOfLayout<[...typeof baseLayout, ...PayloadLiteralToPayloadItemLayout<PL>]>
>;

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
