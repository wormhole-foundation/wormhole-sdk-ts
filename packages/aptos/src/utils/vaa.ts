import { uint8ArrayToHex } from '@wormhole-foundation/sdk-base';

// TODO: why does this use the Algorand method, why isn't this in the vaa folder????

function extract3(buffer: Uint8Array, start: number, size: number) {
  return buffer.slice(start, start + size);
}

/**
 * Parses the VAA into a Map
 * @param vaa The VAA to be parsed
 * @returns The ParsedVAA containing the parsed elements of the VAA
 */
export type ParsedVAA = {
  version: number;
  index: number;
  siglen: number;
  signatures: Uint8Array;
  sigs: Uint8Array[];
  digest: Uint8Array;
  timestamp: number;
  nonce: number;
  chainRaw: string;
  chain: number;
  emitter: string;
  sequence: bigint;
  consistency: number;
  Meta:
    | 'Unknown'
    | 'TokenBridge'
    | 'TokenBridge RegisterChain'
    | 'TokenBridge UpgradeContract'
    | 'CoreGovernance'
    | 'TokenBridge Attest'
    | 'TokenBridge Transfer'
    | 'TokenBridge Transfer With Payload';
  module?: Uint8Array;
  action?: number;
  targetChain?: number;
  EmitterChainID?: number;
  targetEmitter?: Uint8Array;
  newContract?: Uint8Array;
  NewGuardianSetIndex?: number;
  Type?: number;
  Contract?: string;
  FromChain?: number;
  Decimals?: number;
  Symbol?: Uint8Array;
  Name?: Uint8Array;
  TokenId?: Uint8Array;
  Amount?: Uint8Array;
  ToAddress?: Uint8Array;
  ToChain?: number;
  Fee?: Uint8Array;
  FromAddress?: Uint8Array;
  Payload?: Uint8Array;
  Body?: Uint8Array;

  uri?: string;
};
export function _parseVAAAlgorand(vaa: Uint8Array): ParsedVAA {
  let ret = {} as ParsedVAA;
  let buf = Buffer.from(vaa);
  ret.version = buf.readIntBE(0, 1);
  ret.index = buf.readIntBE(1, 4);
  ret.siglen = buf.readIntBE(5, 1);
  const siglen = ret.siglen;
  if (siglen) {
    ret.signatures = extract3(vaa, 6, siglen * 66);
  }
  const sigs: Uint8Array[] = [];
  for (let i = 0; i < siglen; i++) {
    const start = 6 + i * 66;
    const len = 66;
    const sigBuf = extract3(vaa, start, len);
    sigs.push(sigBuf);
  }
  ret.sigs = sigs;
  let off = siglen * 66 + 6;
  ret.digest = vaa.slice(off); // This is what is actually signed...
  ret.timestamp = buf.readIntBE(off, 4);
  off += 4;
  ret.nonce = buf.readIntBE(off, 4);
  off += 4;
  ret.chainRaw = Buffer.from(extract3(vaa, off, 2)).toString('hex');
  ret.chain = buf.readIntBE(off, 2);
  off += 2;
  ret.emitter = Buffer.from(extract3(vaa, off, 32)).toString('hex');
  off += 32;
  ret.sequence = buf.readBigUInt64BE(off);
  off += 8;
  ret.consistency = buf.readIntBE(off, 1);
  off += 1;

  ret.Meta = 'Unknown';

  if (
    !Buffer.compare(
      extract3(buf, off, 32),
      Buffer.from(
        '000000000000000000000000000000000000000000546f6b656e427269646765',
        'hex',
      ),
    )
  ) {
    ret.Meta = 'TokenBridge';
    ret.module = extract3(vaa, off, 32);
    off += 32;
    ret.action = buf.readIntBE(off, 1);
    off += 1;
    if (ret.action === 1) {
      ret.Meta = 'TokenBridge RegisterChain';
      ret.targetChain = buf.readIntBE(off, 2);
      off += 2;
      ret.EmitterChainID = buf.readIntBE(off, 2);
      off += 2;
      ret.targetEmitter = extract3(vaa, off, 32);
      off += 32;
    } else if (ret.action === 2) {
      ret.Meta = 'TokenBridge UpgradeContract';
      ret.targetChain = buf.readIntBE(off, 2);
      off += 2;
      ret.newContract = extract3(vaa, off, 32);
      off += 32;
    }
  } else if (
    !Buffer.compare(
      extract3(buf, off, 32),
      Buffer.from(
        '00000000000000000000000000000000000000000000000000000000436f7265',
        'hex',
      ),
    )
  ) {
    ret.Meta = 'CoreGovernance';
    ret.module = extract3(vaa, off, 32);
    off += 32;
    ret.action = buf.readIntBE(off, 1);
    off += 1;
    ret.targetChain = buf.readIntBE(off, 2);
    off += 2;
    ret.NewGuardianSetIndex = buf.readIntBE(off, 4);
  }

  //    ret.len=vaa.slice(off).length)
  //    ret.act=buf.readIntBE(off, 1))

  ret.Body = vaa.slice(off);

  if (vaa.slice(off).length === 100 && buf.readIntBE(off, 1) === 2) {
    ret.Meta = 'TokenBridge Attest';
    ret.Type = buf.readIntBE(off, 1);
    off += 1;
    ret.Contract = uint8ArrayToHex(extract3(vaa, off, 32));
    off += 32;
    ret.FromChain = buf.readIntBE(off, 2);
    off += 2;
    ret.Decimals = buf.readIntBE(off, 1);
    off += 1;
    ret.Symbol = extract3(vaa, off, 32);
    off += 32;
    ret.Name = extract3(vaa, off, 32);
  }

  if (vaa.slice(off).length === 133 && buf.readIntBE(off, 1) === 1) {
    ret.Meta = 'TokenBridge Transfer';
    ret.Type = buf.readIntBE(off, 1);
    off += 1;
    ret.Amount = extract3(vaa, off, 32);
    off += 32;
    ret.Contract = uint8ArrayToHex(extract3(vaa, off, 32));
    off += 32;
    ret.FromChain = buf.readIntBE(off, 2);
    off += 2;
    ret.ToAddress = extract3(vaa, off, 32);
    off += 32;
    ret.ToChain = buf.readIntBE(off, 2);
    off += 2;
    ret.Fee = extract3(vaa, off, 32);
  }

  if (off >= buf.length) {
    return ret;
  }
  if (buf.readIntBE(off, 1) === 3) {
    ret.Meta = 'TokenBridge Transfer With Payload';
    ret.Type = buf.readIntBE(off, 1);
    off += 1;
    ret.Amount = extract3(vaa, off, 32);
    off += 32;
    ret.Contract = uint8ArrayToHex(extract3(vaa, off, 32));
    off += 32;
    ret.FromChain = buf.readIntBE(off, 2);
    off += 2;
    ret.ToAddress = extract3(vaa, off, 32);
    off += 32;
    ret.ToChain = buf.readIntBE(off, 2);
    off += 2;
    ret.FromAddress = extract3(vaa, off, 32);
    off += 32;
    ret.Payload = vaa.slice(off);
  }

  return ret;
}
