export function makeVAA(payload: any) {
  return {
    version: 1,
    guardianSetIndex: 0,
    timestamp: 0,
    nonce: 0,
    payload: payload,
    guardianSignature: new Uint8Array(65),
    hash: new Uint8Array(32),
  } as const;
}
