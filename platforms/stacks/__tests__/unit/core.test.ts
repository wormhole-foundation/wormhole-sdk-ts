import { fetchCallReadOnlyFunction } from "@stacks/transactions"
import { CONFIG } from "@wormhole-foundation/sdk-connect";
import { DEFAULT_NETWORK } from "@wormhole-foundation/sdk-connect";
import { StacksPlatform } from "../../src/platform.js";

import '@wormhole-foundation/sdk-stacks-core';

describe("Stacks Core bridge tests", () => {

  const network = DEFAULT_NETWORK
  const configs = CONFIG[network].chains;
  

  it("test", async() => {
    const res = await fetchCallReadOnlyFunction({
      contractName: 'wormhole-core-v4',
      contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      functionName: 'get-chain-id',
      functionArgs: [],
      client: {
        baseUrl: 'http://localhost:3999'
      },
      senderAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
    }
    )

    console.log(res)
  })

  it("test2", async() => {

    const platform = new StacksPlatform(network, configs);
    // console.log(platform)
    // console.log(configs["Berachain"])
    // console.log(configs["Stacks"])


    

    const coreProtocol = await platform.getProtocol("WormholeCore", undefined)
    console.log(coreProtocol)
  })
})
