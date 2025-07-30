import { CONFIG, keccak256, serialize, signAndSendWait, UniversalAddress } from "@wormhole-foundation/sdk-connect";
import { StacksPlatform } from "../../src/platform.js";
import '@wormhole-foundation/sdk-stacks-core';
import '@wormhole-foundation/sdk-evm-core';
import { getStacksSigner } from "../../src/signer.js";
import { StacksNetwork } from "@stacks/network";
import { createVAA } from "@wormhole-foundation/sdk-connect";
import { secp256k1 } from "@noble/curves/secp256k1"
import { broadcastTransaction, Cl, makeContractCall, privateKeyToAddress } from "@stacks/transactions";
import { mocks } from "@wormhole-foundation/sdk-definitions/testing";
import { VAA } from "@wormhole-foundation/sdk-connect";

jest.setTimeout(60 * 1000)

describe("Stacks Core bridge tests", () => {

  const network = "Devnet"
  const configs = CONFIG[network].chains;

  let coreProtocol: any; // FG TODO FG
  let rpc: StacksNetwork;
  let platform: StacksPlatform<"Devnet">;

  const DEPLOYER_PRIV_KEY = '753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601'
  const WALLET_1_PRIV_KEY = '7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61068649c17801'

  let guardiansPrivKeys: Uint8Array[]
  let guardiansEthKeys: string[]
  let uncompressedGuardianPubKeys: Uint8Array[]
  let mockGuardians: mocks.MockGuardians

  const rpcBaseUrl = "http://localhost:3999"


  beforeAll(async () => {
    platform = new StacksPlatform(network, configs);
    rpc = platform.getRpc()
    coreProtocol = await platform.getProtocol("WormholeCore", rpc)

    guardiansPrivKeys = Array.from({ length: 19 }, () => secp256k1.utils.randomPrivateKey());
    uncompressedGuardianPubKeys = guardiansPrivKeys.map(k => secp256k1.getPublicKey(k, false).slice(1, 65));
    guardiansEthKeys = uncompressedGuardianPubKeys.map(k => Buffer.from(keccak256(k)).slice(12,32).toString('hex'))
    mockGuardians = new mocks.MockGuardians(1, guardiansPrivKeys.map(k => Buffer.from(k).toString('hex')));

    const isActive = await coreProtocol.isActiveDeployment()
    console.log(`Is core contract active: ${isActive}`)
    if(!isActive) {
      // initialize core contract
      const initTx = await makeContractCall({
        contractName: coreProtocol.contractName(),
          contractAddress: coreProtocol.contractAddress(),
          functionName: 'initialize',
          functionArgs: [Cl.none()],
        senderKey: DEPLOYER_PRIV_KEY,
        network: "devnet",
        client: {
          baseUrl: rpcBaseUrl
        }
      })

      const txHash = await broadcastTransaction({
        transaction: initTx,
        client: {
          baseUrl: rpcBaseUrl
        }
      })

      console.log(`Initialize tx hash: ${txHash.txid}`)
      console.log(txHash)
      await waitForTx(txHash.txid)
    }

    let upgradeGuardianSet = false
    try {
      await coreProtocol.getGuardianSetIndex()
    } catch(error) {
      if((error as Error).message.includes("UnwrapFailure")) {
        upgradeGuardianSet = true
      } else {
        throw error
      }
    }

    console.log(`Checking if guardian set needs to be upgraded: ${upgradeGuardianSet}`)
    if(upgradeGuardianSet) {
      const vaa = createUpgradeGuardianSetVaa(0)

      const setGuardianSetTx = await makeContractCall({
        contractName: coreProtocol.contractName(),
          contractAddress: coreProtocol.contractAddress(),
        functionName: 'guardian-set-upgrade',
        functionArgs: [Cl.buffer(serialize(vaa)), Cl.list(uncompressedGuardianPubKeys.map(k => Cl.buffer(k)))],
        senderKey: DEPLOYER_PRIV_KEY,
        network: "devnet",
        client: {
          baseUrl: rpcBaseUrl
        }
      })

      const setGuardianSetTxHash = await broadcastTransaction({
        transaction: setGuardianSetTx,
        client: {
          baseUrl: rpcBaseUrl
        }
      })
      console.log(`Set guardian set tx hash: ${setGuardianSetTxHash.txid}`)
      console.log(setGuardianSetTxHash)
      await waitForTx(setGuardianSetTxHash.txid)
      console.log(`Set guardian set tx mined`)
    }
  })

  it("get message fee", async() => {
    const messageFee = await coreProtocol.getMessageFee()
    expect(messageFee).toBe(1n)
  })

  it("get active guardian set", async() => {
    const activeGuardianSetIndex = await coreProtocol.getGuardianSetIndex()
    expect(activeGuardianSetIndex).toBe(1)

    // TEMP?
    // const newGuardiansPrivKeys = Array.from({ length: 19 }, () => secp256k1.utils.randomPrivateKey());
    // const newUncompressedGuardianPubKeys = newGuardiansPrivKeys.map(k => secp256k1.getPublicKey(k, false).slice(1, 65));
    // const newGuardiansEthKeys = newUncompressedGuardianPubKeys.map(k => Buffer.from(keccak256(k)).slice(12,32).toString('hex'))

    // const newGuardiansUpgradeVaa = createUpgradeGuardianSetVaa(1, newGuardiansEthKeys)
    // console.log(`NEW GUARDIANS VAA`)
    // console.log(newGuardiansUpgradeVaa)

    // const setGuardianSetTx = await makeContractCall({
    //   contractName: coreProtocol.contractName(),
    //     contractAddress: coreProtocol.contractAddress(),
    //     functionName: 'guardian-set-upgrade',
    //     functionArgs: [Cl.buffer(serialize(newGuardiansUpgradeVaa)), Cl.list(newUncompressedGuardianPubKeys.map(k => Cl.buffer(k)))],
    //     senderKey: DEPLOYER_PRIV_KEY,
    //     network: "devnet",
    //     client: {
    //       baseUrl: rpcBaseUrl
    //     }
    // })

    // const setGuardianSetTxHash = await broadcastTransaction({
    //   transaction: setGuardianSetTx,
    //   client: {
    //     baseUrl: rpcBaseUrl
    //   }
    // })
    // console.log(`NEW GUARDIANS Set guardian set tx hash: ${setGuardianSetTxHash.txid}`)
    // console.log(setGuardianSetTxHash)
    // await waitForTx(setGuardianSetTxHash.txid)
    // console.log(`NEW GUARDIANS Set guardian set tx mined`)
    // expect(activeGuardianSetIndex).toBe(1)
  })

  it("get guardian set", async() => {
    const guardianSet = await coreProtocol.getGuardianSet(1)
    expect(guardianSet.keys.length).toBe(19)
    // TODO FG TODO
  })

  it("publish message", async() => {
    const txHash = await publishMessage("yo")
    expect(txHash).toBeDefined()
  })

  it("parseTransaction", async() => {
    const txHash = await publishMessage("yo")
    let whMessageIds = await coreProtocol.parseTransaction(txHash.txId)
    const maxRetries = 10
    let retries = 0

    while(whMessageIds.length === 0 && retries < maxRetries) {
      retries++
      console.log(txHash)
      console.log(`Waiting for message ${txHash.txId} to be parsed... ${retries}/${maxRetries}`)
      await new Promise(resolve => setTimeout(resolve, 1000))
      whMessageIds = await coreProtocol.parseTransaction(txHash.txId)
    }

    const wallet1Addr = privateKeyToAddress(WALLET_1_PRIV_KEY, platform.network.toString().toLowerCase() as any)
    expect(whMessageIds.length).toBe(1)
    expect(whMessageIds[0].emitter.toString()).toBe(`0x${Buffer.from(keccak256(wallet1Addr)).toString('hex')}`)
    expect(whMessageIds[0].emitterPrincipal).toBe(wallet1Addr)
    // FG TODO FG test sequence
  })

  function createUpgradeGuardianSetVaa(guardianSetId: number, providedEthKeys?: string[], providedMockGuardians?: mocks.MockGuardians): VAA {
    const vaa = createVAA(
      "WormholeCore:GuardianSetUpgrade",
      {
        guardianSet: guardianSetId,
        timestamp: 1784985530,
        nonce: 0,
        emitterChain: "Solana", // id 0
        emitterAddress: new UniversalAddress('0000000000000000000000000000000000000000000000000000000000000004'),
        sequence: 1n,
        consistencyLevel: 0,
        signatures: [],
        payload: {
          chain: "Stacks",
          actionArgs: {
            guardianSet: guardianSetId + 1,
            guardians: providedEthKeys || guardiansEthKeys
          }
        }
      }
    )
    if(providedMockGuardians) {
      providedMockGuardians.addSignatures(vaa)
    } else {
      mockGuardians.addSignatures(vaa)
    }
    return vaa
  }

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

  async function waitForTx(txId: string) {
    const apiUrl = `${rpcBaseUrl}/extended/v1/tx/${txId}`
    const res = await fetch(apiUrl)
    let data = await res.json()
    let tries = 0
    while(data.tx_status !== 'success') {
      console.log(`Waiting for tx ${txId}... try: ${tries}`)
      await new Promise(resolve => setTimeout(resolve, 1000))
      data = await fetch(apiUrl).then(res => res.json())
      tries++
    }
    console.log(`tx mined!: ${txId}`)
  }
})
