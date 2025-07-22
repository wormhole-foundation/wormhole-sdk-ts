import { StacksAddress, StacksZeroAddress } from "../../src/address.js"

describe("Stacks Address Tests", () => {
    
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
})

