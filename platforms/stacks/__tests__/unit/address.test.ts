import { UniversalAddress } from "@wormhole-foundation/sdk-connect"
import { StacksAddress, StacksZeroAddress } from "../../src/address.js"

describe("Stacks Address Tests", () => {

  const ADDRESS = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    
  it("Create address from string - unwrap", () => {
    const address = new StacksAddress(StacksZeroAddress)
    const unwrapped = address.unwrap()
    expect(unwrapped).toBe(StacksZeroAddress)
  })

  it("Create address from string - toString", () => {
    const address = new StacksAddress(StacksZeroAddress)
    const toString = address.toString()
    expect(toString).toBe(StacksZeroAddress)
  })

  it("universal address", () => {
    const address = new UniversalAddress(ADDRESS, "keccak256")
    expect(address.toString()).toBe("0xd46812cb7885790b7096a3e2b8feff7f997b16e6f57e5fb1ac8dc25d9df70ffb")
  })

  it("contract address to universal", () => {
    const address = new UniversalAddress(`${ADDRESS}.wormhole-core-v4`, "keccak256")
    expect(address.toString()).toBe("0x41bb47779fcfb96e8d29ae8883974350cd660649c0269f517f0f966c5ef9bf68")
  })

  it("stacks to universal", () => {
    const address = new StacksAddress(ADDRESS)
    const universalAddress = address.toUniversalAddress()
    expect(universalAddress.toString()).toBe("0xd46812cb7885790b7096a3e2b8feff7f997b16e6f57e5fb1ac8dc25d9df70ffb")
  })

  it("is valid address", () => {
    expect(StacksAddress.isValidAddress(ADDRESS)).toBe(true)
  })
})
