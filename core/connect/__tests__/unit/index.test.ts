import { Wormhole } from '../../src/wormhole';

describe('exporer link builder', () => {
  it('true equals true', () => {
    expect(true).toBeTruthy();
  });
});

describe('VAA Tests', () => {
  const wh = new Wormhole('Testnet', []);

  test('GetVAA', async () => {
    const vaa = await wh.getVAA(
      'Celo',
      '0x05ca6037eC51F8b712eD2E6Fa72219FEaE74E153',
      469n,
    );

    console.log(vaa);
  });
});
