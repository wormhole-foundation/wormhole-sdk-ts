
import { Context } from "../../src/types";
import { Wormhole } from "../../src/wormhole";
import { MockContext1, MockContext2 } from "../mockContext";

const network = "Testnet";

describe('registers context classes correctly', () => {
  let wormhole: Wormhole;
  beforeEach(async () => {
    const contextConfig = {
      [Context.EVM]: MockContext1,
      [Context.SOLANA]: MockContext2,
    }
    wormhole = new Wormhole(network, contextConfig);
  })
  it('initializes and registers context classes correctly', async () => {
    const evmContext = wormhole.getContext("Ethereum");
    const solanaContext = wormhole.getContext("Solana");
    const evmAnswer = await evmContext.startTransfer('native', BigInt(0), 1, '', 2, '', undefined);
    expect(evmAnswer).toEqual(1);
    const solanaAnswer = await solanaContext.startTransfer('native', BigInt(0), 1, '', 2, '', undefined);
    expect(solanaAnswer).toEqual(2);
  })
  it('contexts can access other contexts', async () => {
    const evmContext = wormhole.getContext("Ethereum");
    const solanaContext = wormhole.getContext("Solana");
    // @ts-ignore
    const getSolanaFromEvm = evmContext.wormhole.getContext("Solana");
    expect(getSolanaFromEvm).toBeTruthy();
    // @ts-ignore
    const getEvmFromSolana = solanaContext.wormhole.getContext("Ethereum");
    expect(getEvmFromSolana).toBeTruthy();
  })
});
