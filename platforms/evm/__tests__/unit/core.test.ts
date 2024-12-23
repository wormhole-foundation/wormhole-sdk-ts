import { describe, test } from '@jest/globals';
import { ethers } from 'ethers';
import { EvmWormholeCore } from '@wormhole-foundation/sdk-evm-core';
import { contracts } from '@wormhole-foundation/sdk-connect';
import { guardians } from '@wormhole-foundation/sdk-base';

import '@wormhole-foundation/sdk-evm-core';

describe('Core tests', function () {
  test('Check latest mainnet guardian set', async () => {
    const rpc = process.env.ETH_RPC
      ? new ethers.JsonRpcProvider(process.env.ETH_RPC)
      : ethers.getDefaultProvider('mainnet');

    const core = new EvmWormholeCore('Mainnet', 'Ethereum', rpc, {
      coreBridge: contracts.coreBridge.get('Mainnet', 'Ethereum'),
    });

    const index = await core.getGuardianSetIndex();
    // If this test fails, the guardian set index may have been updated
    expect(index).toBe(4);

    const guardianSet = await core.getGuardianSet(index);
    expect(guardianSet.index).toBe(index);

    const localGuardianSet = [...guardians.getGuardianSet('Mainnet', 4)];
    expect(localGuardianSet.length).toBe(guardianSet.keys.length);

    for (let i = 0; i < guardianSet.keys.length; i++) {
      expect(guardianSet.keys[i]).toBe(localGuardianSet[i]?.address);
    }
  });
});
