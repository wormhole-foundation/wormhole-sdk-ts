import { describe, expect, test } from "@jest/globals";
import {
  bytesVectorName,
  coinTypeKeyName,
  dummyFieldName,
  u16Name,
} from "./../../src/utils.js";

/**
 * Pure, offline unit tests for the gRPC dynamic-field name BCS encoders.
 * Expected byte shapes captured from live mainnet listDynamicFields probes (2026-06).
 */
describe("gRPC dynamic-field name BCS encoders", () => {
  test("dummyFieldName: struct { dummy_field: bool=false } → [0]", () => {
    const name = dummyFieldName("0xabc::token_registry::Key<0x2::sui::SUI>");
    expect(name.type).toBe("0xabc::token_registry::Key<0x2::sui::SUI>");
    expect(Array.from(name.bcs)).toEqual([0]);
  });

  test("coinTypeKeyName: { chain: u16, addr: vector<u8> } → [chainLo, chainHi, 0x20, ...addr]", () => {
    const addr = new Uint8Array(32).fill(0xab);
    const name = coinTypeKeyName("0xabc::token_registry::CoinTypeKey", 6, addr);
    const bytes = Array.from(name.bcs);
    expect(bytes.slice(0, 3)).toEqual([6, 0, 0x20]); // chain=6 (u16 LE), vector length 32
    expect(bytes.slice(3)).toEqual(Array.from(addr));
    expect(bytes.length).toBe(3 + 32);
  });

  test("coinTypeKeyName: chain encodes as little-endian u16", () => {
    const name = coinTypeKeyName("T", 21, new Uint8Array(32));
    expect(Array.from(name.bcs).slice(0, 2)).toEqual([21, 0]);
    const big = coinTypeKeyName("T", 0x0123, new Uint8Array(0));
    expect(Array.from(big.bcs).slice(0, 2)).toEqual([0x23, 0x01]);
  });

  test("bytesVectorName: vector<u8> → length-prefixed bytes", () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const name = bytesVectorName("vector<u8>", data);
    expect(name.type).toBe("vector<u8>");
    expect(Array.from(name.bcs)).toEqual([4, 1, 2, 3, 4]);

    const b32 = new Uint8Array(32).fill(7);
    expect(Array.from(bytesVectorName("T", b32).bcs)).toEqual([0x20, ...Array(32).fill(7)]);
  });

  test("u16Name: little-endian u16", () => {
    expect(Array.from(u16Name("u16", 6).bcs)).toEqual([6, 0]);
    expect(Array.from(u16Name("u16", 258).bcs)).toEqual([2, 1]);
  });
});
