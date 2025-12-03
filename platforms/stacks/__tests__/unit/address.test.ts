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
    const address = new UniversalAddress(ADDRESS, "string")
    expect(address.toString()).toBe(`0x${Buffer.from(ADDRESS).toString("hex")}`)
  })

  it("contract address to universal", () => {
    const contractAddress = `${ADDRESS}.wormhole-core-v4`
    const address = new UniversalAddress(contractAddress, "string")
    expect(address.toString()).toBe(`0x${Buffer.from(contractAddress).toString("hex")}`)
  })

  it("stacks to universal", () => {
    const address = new StacksAddress(ADDRESS)
    const universalAddress = address.toUniversalAddress()
    expect(universalAddress.toString()).toBe(`0x${Buffer.from(ADDRESS).toString("hex")}`)
  })

  it("is valid address", () => {
    expect(StacksAddress.isValidAddress(ADDRESS)).toBe(true)
  })
})
