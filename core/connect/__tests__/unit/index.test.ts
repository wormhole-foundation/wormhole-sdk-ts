import {
  UniversalAddress,
  VAA,
  deserializePayload,
} from '@wormhole-foundation/sdk-definitions';
import { Wormhole } from '../../src/wormhole';

describe('VAA Tests', () => {
  const wh = new Wormhole('Testnet', []);

  let vaa: VAA;
  test('GetVAA', async () => {
    const parsedVaa = await wh.getVAA(
      'Celo',
      new UniversalAddress(
        '0x00000000000000000000000005ca6037eC51F8b712eD2E6Fa72219FEaE74E153',
      ),
      469n,
    );
    console.log(parsedVaa);
    expect(parsedVaa).toBeTruthy();
    if (parsedVaa !== undefined) vaa = parsedVaa;

    console.log(vaa);
  });

  test('ParsePayload', async () => {
    const vaaBytes = await wh.getVAABytes(
      'Celo',
      new UniversalAddress(
        '0x00000000000000000000000005ca6037eC51F8b712eD2E6Fa72219FEaE74E153',
      ),
      469n,
    );
    if (vaaBytes === undefined) return;
    console.log(Buffer.from(vaaBytes).toString('base64'));

    const payload = deserializePayload('Transfer', vaaBytes);
    console.log(payload);
  });
});
