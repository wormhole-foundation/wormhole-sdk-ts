import { TESTNET_CHAINS } from "../../src/config/TESTNET";
import { Network, Context } from "../../src/types";
import { Wormhole } from "../../src/wormhole";
import { MockContext1, MockContext2 } from "../mockContext";

const NETWORK = Network.TESTNET;

describe('registers context classes correctly', () => {
  let wormhole: Wormhole;
  beforeEach(async () => {
    const contextConfig = {
      [Context.EVM]: MockContext1,
      [Context.SOLANA]: MockContext2,
    }
    wormhole = new Wormhole(NETWORK, contextConfig);
  })
  it('initializes and registers context classes correctly', async () => {
    const evmContext = wormhole.getContext(TESTNET_CHAINS.goerli);
    const solanaContext = wormhole.getContext(TESTNET_CHAINS.solana);
    const evmAnswer = await evmContext.startTransfer('native', BigInt(0), 1, '', 2, '', undefined);
    expect(evmAnswer).toEqual(1);
    const solanaAnswer = await solanaContext.startTransfer('native', BigInt(0), 1, '', 2, '', undefined);
    expect(solanaAnswer).toEqual(2);
  })
  it('contexts can access other contexts', async () => {
    const evmContext = wormhole.getContext(TESTNET_CHAINS.goerli);
    const solanaContext = wormhole.getContext(TESTNET_CHAINS.solana);
    // @ts-ignore
    const getSolanaFromEvm = evmContext.wormhole.getContext(TESTNET_CHAINS.solana);
    expect(getSolanaFromEvm).toBeTruthy();
    // @ts-ignore
    const getEvmFromSolana = solanaContext.wormhole.getContext(TESTNET_CHAINS.goerli);
    expect(getEvmFromSolana).toBeTruthy();
  })
});
