// @ts-nocheck
import { CONFIG, keccak256, signAndSendWait, UniversalAddress } from "@wormhole-foundation/sdk-connect";
import { StacksPlatform } from "../../src/platform.js";
import '@wormhole-foundation/sdk-stacks-core';
import '@wormhole-foundation/sdk-evm-core';
import { getStacksSigner } from "../../src/signer.js";
import { StacksNetwork } from "@stacks/network";
import { createVAA } from "@wormhole-foundation/sdk-connect";
import { serialize } from "@wormhole-foundation/sdk-connect";
import { deserialize } from "@wormhole-foundation/sdk-connect";
import { secp256k1 } from "@noble/curves/secp256k1"
import { broadcastTransaction, Cl, fetchCallReadOnlyFunction, makeContractCall, privateKeyToAddress } from "@stacks/transactions";
import { mocks } from "@wormhole-foundation/sdk-definitions/testing";

describe("Stacks Core bridge tests", () => {

  const network = "Testnet"
  // const network = DEFAULT_NETWORK
  const configs = CONFIG[network].chains;

  let coreProtocol: any; // FG TODO FG
  let rpc: StacksNetwork;
  let platform: StacksPlatform<"Testnet">;

  const DEPLOYER_PRIV_KEY = '753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601'
  const WALLET_1_PRIV_KEY = '7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61068649c17801'

  beforeAll(async () => {
    platform = new StacksPlatform<"Testnet">(network, configs);
    rpc = platform.getRpc("Stacks")
    coreProtocol = await platform.getProtocol("WormholeCore", rpc)

    // initialize core contract
    // FG TODO FG - only if it is not already initialized
    const initTx = await makeContractCall({
      contractName: coreProtocol.contractName(),
        contractAddress: coreProtocol.contractAddress(),
        functionName: 'initialize',
        functionArgs: [Cl.none()],
        senderKey: DEPLOYER_PRIV_KEY,
        network: "testnet",
        client: {
          baseUrl: 'http://localhost:3999'
        }
    })

    const txHash = await broadcastTransaction({
      transaction: initTx,
      client: {
        baseUrl: 'http://localhost:3999'
      }
    })

    console.log(`Initialize tx hash: ${txHash.txid}`)
    console.log(txHash)


    const guardiansPrivKeys = Array.from({ length: 19 }, () => secp256k1.utils.randomPrivateKey());
    const uncompressedPubKeys = guardiansPrivKeys.map(k => secp256k1.getPublicKey(k, false).slice(1, 65));
    const guardiansEthKeys = uncompressedPubKeys.map(k => Buffer.from(keccak256(k)).slice(12,32).toString('hex'))
    const mockGuardians = new mocks.MockGuardians(1, guardiansPrivKeys.map(k => Buffer.from(k).toString('hex')));

    console.log('*** guardiansEthKeys ***')
    console.log(guardiansEthKeys)

        // initialize guardian set
    let vaa = createVAA(
      "WormholeCore:GuardianSetUpgrade",
      {
        guardianSet: 0,
        timestamp: 1784985530,
        nonce: 0,
        emitterChain: "Solana",
        emitterAddress: new UniversalAddress('0000000000000000000000000000000000000000000000000000000000000004'),
        sequence: 1n,
        consistencyLevel: 0,
        signatures: [],
        payload: {
          chain: "Stacks",
          actionArgs: {
            guardianSet: 1,
            guardians: guardiansEthKeys
          }
        }
      }
    )
        
    console.log(`%%%%%%%%% PRE %%%%%%%%%%%%%%`)
    console.log(deserialize("WormholeCore:GuardianSetUpgrade", serialize(vaa)))
    mockGuardians.addSignatures(vaa)
    
    console.log(`%%%%%%%%% POST %%%%%%%%%%%%%%`)
    console.log(deserialize("WormholeCore:GuardianSetUpgrade", serialize(vaa)))

    const setGuardianSetTx = await makeContractCall({
      contractName: coreProtocol.contractName(),
        contractAddress: coreProtocol.contractAddress(),
        functionName: 'guardian-set-upgrade',
        functionArgs: [Cl.buffer(serialize(vaa)), Cl.list(uncompressedPubKeys.map(k => Cl.buffer(k)))],
        senderKey: DEPLOYER_PRIV_KEY,
        network: "testnet",
        client: {
          baseUrl: 'http://localhost:3999'
        }
    })

    const setGuardianSetTxHash = await broadcastTransaction({
      transaction: setGuardianSetTx,
      client: {
        baseUrl: 'http://localhost:3999'
      }
    })
    console.log(`Set guardian set tx hash: ${setGuardianSetTxHash.txid}`)
    console.log(setGuardianSetTxHash)
  })

  it("test", async() => {
    const res = await fetchCallReadOnlyFunction({
      contractName: 'wormhole-core-v4',
      contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      functionName: 'get-message-fee',
      functionArgs: [],
      client: {
        baseUrl: 'http://localhost:3999'
      },
      senderAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
    })

    console.log(res)
  })

  it("get message fee", async() => {
    const messageFee = await coreProtocol.getMessageFee()
    expect(messageFee).toBe(1n)
  })

  it("get active guardian set", async() => {
    const activeGuardianSetIndex = await coreProtocol.getGuardianSetIndex()
    console.log(activeGuardianSetIndex)
    expect(Number(activeGuardianSetIndex['set-id'].value)).toBe(1)
  })

  it("publish message", async() => {
    const txHash = await publishMessage("yo")
    console.log(`Published message tx hash: ${txHash.txId}`)
    expect(txHash).toBeDefined()
  })

  it("parseTransaction", async() => {
    const txHash = await publishMessage("yo")
    let whMessageIds = await coreProtocol.parseTransaction(txHash.txId)
    const maxRetries = 10
    let retries = 0

    while(whMessageIds.length === 0 && retries < maxRetries) {
      retries++
      console.log(`Waiting for message to be parsed... ${retries}/${maxRetries}`)
      await new Promise(resolve => setTimeout(resolve, 1000))
      whMessageIds = await coreProtocol.parseTransaction(txHash.txId)
    }
    
    console.log(whMessageIds)
    const wallet1Addr = privateKeyToAddress(WALLET_1_PRIV_KEY, platform.network.toString().toLowerCase() as any)
    expect(whMessageIds.length).toBe(1)
    expect(whMessageIds[0].emitter.toString()).toBe(`0x${Buffer.from(keccak256(wallet1Addr)).toString('hex')}`)
    expect(whMessageIds[0].emitterPrincipal).toBe(wallet1Addr)
    // FG TODO FG test sequence
  })

  async function publishMessage(msg: string): Promise<{txId: string, error?: any}> {
    const stacksChain = platform.getChain("Stacks") as any
    
    const signer = await getStacksSigner(
      stacksChain,
      rpc,
      WALLET_1_PRIV_KEY,
    )
    const txs = coreProtocol.publishMessage(
      signer,
      msg,
      0n,
      0n,
    )
    
    const txHashes = await signAndSendWait(txs, signer)
    const txResult = txHashes[0] as any // in stacks this can contain errors too
    if (!txResult) throw new Error("Transaction not sent")
    return {
      txId: txResult.txid,
      error: txResult.error,
    }
  }

})
